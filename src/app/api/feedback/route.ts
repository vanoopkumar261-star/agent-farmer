import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";
import { normalizeEmail, validateEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 4000;
const MAX_EMAIL = 254;

/**
 * Landing-page feedback: store it, then tell the team.
 *
 * Two things happen here and they are deliberately not equally important. The
 * database write is the job — if it fails the visitor is told and nothing is
 * lost silently. The notification email is best-effort: Resend being down must
 * not turn a successfully-saved piece of feedback into an error page, so a
 * failed send leaves `notified_at` null and is picked up by looking at the
 * table rather than by the visitor seeing a failure they cannot act on.
 *
 * The table is service-role only (migration 011) — no RLS policy grants the
 * anon key insert, so this route is the single door in. That also means the
 * validation below is the real gate, not a client-side convenience.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("feedback: Supabase service-role env missing");
    return Response.json({ error: "Feedback is not configured." }, { status: 503 });
  }

  let email = "";
  let message = "";
  let honeypot = "";
  try {
    const body = await req.json();
    email = normalizeEmail(String(body?.email ?? "")).slice(0, MAX_EMAIL);
    message = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE);
    honeypot = String(body?.company ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bots fill every field they find. The input is hidden from people and
  // labelled off-limits to screen readers, so anything in it is not a farmer.
  // Answer 200 rather than 400 — telling a bot it failed just invites a retry.
  if (honeypot) return Response.json({ ok: true });

  // Server-side check against the same grammar the form uses. The client's
  // validation is a courtesy; this is the one that decides.
  const emailProblem = validateEmail(email);
  if (emailProblem) {
    return Response.json({ error: emailProblem }, { status: 400 });
  }
  if (message.length < 4) {
    return Response.json({ error: "Please tell us a little more." }, { status: 400 });
  }

  // Attribute the row when a farmer happens to be signed in, but never require
  // it — the whole point of this form is that visitors can use it.
  let ownerId: string | null = null;
  try {
    const {
      data: { user },
    } = await createSupabaseServer().auth.getUser();
    ownerId = user?.id ?? null;
  } catch {
    /* Signed out, or no cookie — anonymous feedback is the normal case. */
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin
    .from("feedback")
    .insert({
      email,
      message,
      owner_id: ownerId,
      source: "landing",
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400),
    })
    .select("id")
    .single();

  if (error) {
    console.error("feedback insert failed:", error);
    return Response.json({ error: "Could not save your feedback." }, { status: 500 });
  }

  const notified = await notify({ email, message, id: data.id });
  if (notified) {
    await admin
      .from("feedback")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  // `notified` is reported so the UI can stay honest if it ever wants to say
  // "saved, but we could not alert the team". The visitor's feedback is stored
  // either way, which is what the success message promises.
  return Response.json({ ok: true, notified });
}

/**
 * Emails the team that feedback arrived. Returns whether it was accepted.
 *
 * Never throws: the caller treats delivery as optional, and a rejected send
 * must not roll back a stored row.
 */
async function notify({
  email,
  message,
  id,
}: {
  email: string;
  message: string;
  id: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_NOTIFY_TO;

  if (!apiKey || !to) {
    console.warn("feedback: RESEND_API_KEY or FEEDBACK_NOTIFY_TO not set — stored without email");
    return false;
  }

  // Defaults to Resend's shared sending domain, which needs no DNS setup. Point
  // FEEDBACK_NOTIFY_FROM at your own verified domain when you have one.
  const from = process.env.FEEDBACK_NOTIFY_FROM || "Agent Farmer <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        // So hitting reply in the mail client answers the farmer, not Resend.
        reply_to: email,
        subject: `New feedback from ${email}`,
        text: [
          "Someone submitted the feedback form on Agent Farmer.",
          "",
          `From:    ${email}`,
          `Time:    ${new Date().toISOString()}`,
          `Row id:  ${id}`,
          "",
          "Message",
          "-------",
          message,
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error("feedback: Resend rejected the send:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("feedback: notification failed:", e);
    return false;
  }
}
