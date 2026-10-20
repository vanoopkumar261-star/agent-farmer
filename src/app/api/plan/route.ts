import { NextResponse } from "next/server";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { readJsonBounded, payloadTooLarge, PayloadTooLargeError, clampStr } from "@/lib/apiInput";
import { createClient } from "@supabase/supabase-js";
import { getPlan, readUsage } from "@/lib/entitlements";
import { PLANS, PLAN_ORDER, fieldLimit, planOf, type Cycle, type PlanId } from "@/lib/plans";

/**
 * Reading and changing a farmer's membership.
 *
 * GET returns the current tier and this month's usage, which is what draws the
 * meters in Settings. POST changes the tier.
 *
 * ── Nothing is charged ───────────────────────────────────────────────────────
 *
 * There is no payment processor behind this. A farmer picks a tier and it
 * applies. The prices shown are real and the costs behind them are real, but
 * no card is taken, so this route cannot bill anyone and does not pretend to.
 * If payment is added later it belongs in front of this route, not inside it.
 */

export const dynamic = "force-dynamic";

type PlanBody = { plan: PlanId; cycle: Cycle; selectedAt: string | null };

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "plan");
  if (!rl.ok) return rateLimited(rl);

  const [farmer, user] = await Promise.all([getSessionFarmer(), getSessionUser()]);
  if (!farmer || !user) {
    return NextResponse.json({ error: "Sign in to see your plan." }, { status: 401 });
  }

  const plan = getPlan(farmer);
  return NextResponse.json({
    plan,
    cycle: farmer.plan_cycle ?? null,
    selectedAt: farmer.plan_selected_at ?? null,
    limits: PLANS[plan].limits,
    usage: await readUsage(user.id),
  });
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "plan");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) {
    return NextResponse.json({ error: "Sign in to change your plan." }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await readJsonBounded(req, 2_000);
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return payloadTooLarge();
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = (input ?? {}) as Record<string, unknown>;
  const requested = clampStr(body.plan, 10);
  if (!PLAN_ORDER.includes(requested as PlanId)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const plan = planOf(requested);
  const cycle: Cycle = clampStr(body.cycle, 10) === "monthly" ? "monthly" : "annual";

  const db = admin();
  if (!db) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  // ── A downgrade never deletes anything ─────────────────────────────────────
  //
  // A farmer on Elite with twelve fields who moves to Pro has twelve fields and
  // a plan that holds five. The tempting fix — drop the newest seven — is data
  // loss dressed as a product rule, and the farmer would discover it after the
  // fact. So the move is refused, with both numbers, and they decide which
  // fields to remove. Nothing here writes to `farms`.
  let fieldCount = 0;
  try {
    const { count } = await db
      .from("farms")
      .select("id", { count: "exact", head: true })
      .eq("farmer_id", farmer.id);
    fieldCount = count ?? 0;
  } catch {
    // Unable to count: allow the change rather than block a farmer over a
    // transient read. The field limit is still enforced when they next add one.
    fieldCount = 0;
  }

  const cap = fieldLimit(plan);
  if (fieldCount > cap) {
    return NextResponse.json(
      {
        error: `You have ${fieldCount} fields and this plan covers ${cap}. Remove ${fieldCount - cap} before switching.`,
        reason: "fields",
        have: fieldCount,
        cap,
      },
      { status: 409 }
    );
  }

  try {
    const { error } = await db
      .from("farmer_profiles")
      .update({
        plan,
        // Free has no billing cycle to speak of, so it carries none rather
        // than an inherited "annual" that means nothing.
        plan_cycle: plan === "free" ? null : cycle,
        plan_selected_at: new Date().toISOString(),
      })
      .eq("id", farmer.id);

    if (error) {
      console.error("plan: update failed —", error.message);
      return NextResponse.json({ error: "Could not change your plan." }, { status: 500 });
    }
  } catch (e) {
    console.error("plan: update threw —", e);
    return NextResponse.json({ error: "Could not change your plan." }, { status: 500 });
  }

  const out: PlanBody = { plan, cycle, selectedAt: new Date().toISOString() };
  return NextResponse.json(out);
}
