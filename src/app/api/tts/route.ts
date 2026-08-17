import { getSessionFarmer } from "@/lib/auth";
import { inferenceBaseUrl } from "@/lib/inference";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";


/** Matches the cap the Python server applies, so we fail fast rather than there. */
const MAX_CHARS = 1200;

/**
 * Speech synthesis for languages the browser cannot speak.
 *
 * The client tries the device voice first and only reaches this route when the
 * farmer's language has no installed voice — seven of the app's nine on desktop
 * Windows. The heavy lifting is Meta's MMS-TTS running in `ml/server.py`, the
 * same FastAPI process that serves disease predictions.
 *
 * A 503 here is expected and not an error state: the Python server is optional,
 * and the client falls back to showing the reply as text when it is not running.
 */
export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "tts");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) {
    return new Response("Not signed in.", { status: 401 });
  }

  let text = "";
  let locale = "en";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (typeof body?.locale === "string") locale = body.locale;
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  if (!text) return new Response("No text supplied.", { status: 400 });

  const inferenceUrl = inferenceBaseUrl();
  if (!inferenceUrl) {
    // No speech server in this environment. 503 is the contract the client
    // already understands: it falls back to the reply as text, silently.
    return new Response("Speech synthesis is not available.", { status: 503 });
  }

  try {
    const res = await fetch(`${inferenceUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      // A cold model load is slow (~30s the first time a language is used);
      // afterwards it is well under a second.
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.error("TTS server error:", res.status);
      return new Response("Speech synthesis unavailable.", { status: 503 });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.byteLength),
        // The same reply gets replayed often; let the browser keep it.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    // Server not running, or the request timed out. Both mean "no speech" —
    // the app keeps working, it just shows the reply instead of saying it.
    console.error("TTS server unreachable:", e);
    return new Response("Speech synthesis unavailable.", { status: 503 });
  }
}
