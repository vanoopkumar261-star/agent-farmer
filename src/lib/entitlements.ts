import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PLANS,
  QUOTA_FOR_FEATURE,
  USAGE_FEATURES,
  atLeast,
  isUnlimited,
  limitOf,
  planOf,
  type PlanId,
  type Quota,
  type UsageFeature,
} from "@/lib/plans";

/**
 * The server side of membership — the only place a route asks "is this allowed".
 *
 * ── Why this is enforced here and not in the UI ──────────────────────────────
 *
 * A padlock on a card is a suggestion. The routes below spend real money —
 * Groq tokens on every scan, TinyFish credits on every browser run — so a
 * paywall that lives only in React is one devtools tab away from being no
 * paywall at all, and the cost lands on us rather than the person who bypassed
 * it. Everything the cards promise is refused here or it is not refused.
 *
 * ── Failing open, deliberately ───────────────────────────────────────────────
 *
 * If Postgres cannot be reached, the quota check allows the call and logs
 * loudly, matching `checkRateLimit`'s posture. The alternative is refusing a
 * farmer who has paid because of a Supabase blip, which is worse: the exposure
 * from failing open is a handful of free-tier scans, while the exposure from
 * failing closed is a paying customer being told their plan does not work. The
 * billable TinyFish rungs keep their own `TfBudget` ceiling regardless, so the
 * money side is still bounded.
 *
 * The tier gate itself never fails open — it reads a column that arrived with
 * the session, so there is nothing to be unavailable.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * The calendar month a usage row belongs to, in IST.
 *
 * Computed in exactly one place so every route agrees on when a month turns
 * over. Doing it per-route in local server time would roll the allowance at
 * 05:30 IST on a Vercel box in UTC, which is both wrong and invisible until a
 * farmer complains that their scans reset in the middle of the night.
 */
export function currentPeriod(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const month = `${ist.getUTCMonth() + 1}`.padStart(2, "0");
  return `${ist.getUTCFullYear()}-${month}`;
}

/** Anything carrying a plan column — the farmer profile, in practice. */
type HasPlan = { plan?: string | null } | null | undefined;

export function getPlan(farmer: HasPlan): PlanId {
  return planOf(farmer?.plan ?? null);
}

export type Guard =
  | { ok: true; plan: PlanId; used?: number; limit?: Quota }
  | {
      ok: false;
      plan: PlanId;
      /** The cheapest tier that would have allowed this. Drives the upgrade prompt. */
      requiredPlan: PlanId;
      reason: "plan" | "quota";
      feature: string;
      used: number;
      limit: Quota;
    };

/**
 * A tier gate with no counting — for features that are simply in or out.
 */
export function requirePlan(farmer: HasPlan, min: PlanId, feature: string): Guard {
  const plan = getPlan(farmer);
  if (atLeast(plan, min)) return { ok: true, plan };
  return {
    ok: false,
    plan,
    requiredPlan: min,
    reason: "plan",
    feature,
    used: 0,
    limit: 0,
  };
}

/**
 * Reads this month's usage without touching it.
 *
 * Separate from `consumeQuota` on purpose: rendering a meter must never cost a
 * farmer an allowance. Any route or page that wants to *show* the numbers uses
 * this; only the act of doing the work calls the one below.
 */
export async function readUsage(
  ownerId: string
): Promise<Record<UsageFeature, number>> {
  const empty = { disease_scan: 0, assistant_query: 0, live_lookup: 0 };
  const db = admin();
  if (!db || !ownerId) return empty;

  try {
    const { data, error } = await db
      .from("feature_usage")
      .select("feature, used")
      .eq("owner_id", ownerId)
      .eq("period", currentPeriod());
    if (error || !Array.isArray(data)) return empty;

    const out = { ...empty };
    for (const row of data as { feature: string; used: number }[]) {
      if ((USAGE_FEATURES as string[]).includes(row.feature)) {
        out[row.feature as UsageFeature] = Number(row.used) || 0;
      }
    }
    return out;
  } catch {
    // Before migration 037, or during an outage: report zeros rather than
    // breaking a page that only wanted to draw a progress bar.
    return empty;
  }
}

/**
 * Checks a metered allowance and, if there is room, spends one.
 *
 * ── Call this AFTER the work succeeds ────────────────────────────────────────
 *
 * Every call site runs the real work first and charges afterwards. A Groq
 * timeout or a TinyFish failure must not consume one of a free farmer's three
 * scans — they would have paid for an error message. The pre-flight refusal
 * happens in `checkQuota` below, which does not increment.
 */
export async function checkQuota(
  ownerId: string,
  feature: UsageFeature,
  plan: PlanId
): Promise<Guard> {
  const quotaKey = QUOTA_FOR_FEATURE[feature];
  const limit = limitOf(plan, quotaKey);

  // Unlimited never touches the table. Elite is the common paid path and it
  // costs no extra query; the counters stay small as a side effect.
  if (isUnlimited(limit)) return { ok: true, plan, limit };

  // A zero allowance is a tier gate wearing a quota's clothes: free has no
  // live lookups at all, so name the tier that does rather than reporting
  // "0 of 0 used", which reads like a bug.
  if (limit <= 0) {
    const required = requiredPlanFor(feature);
    return {
      ok: false,
      plan,
      requiredPlan: required,
      reason: "plan",
      feature,
      used: 0,
      limit,
    };
  }

  const used = (await readUsage(ownerId))[feature];
  if (used >= limit) {
    return {
      ok: false,
      plan,
      requiredPlan: requiredPlanFor(feature, plan),
      reason: "quota",
      feature,
      used,
      limit,
    };
  }
  return { ok: true, plan, used, limit };
}

/**
 * Records one use. Returns the new count, or null if it could not be recorded.
 *
 * Never throws: the work is already done and the farmer already has their
 * answer, so a counter that could not be written is a billing inaccuracy, not
 * a reason to turn a successful request into a failure.
 */
export async function consumeQuota(
  ownerId: string,
  feature: UsageFeature,
  plan: PlanId
): Promise<number | null> {
  if (isUnlimited(limitOf(plan, QUOTA_FOR_FEATURE[feature]))) return null;

  const db = admin();
  if (!db || !ownerId) return null;
  try {
    const { data, error } = await db.rpc("bump_feature_usage", {
      p_owner: ownerId,
      p_feature: feature,
      p_period: currentPeriod(),
    });
    if (error) {
      console.error(`entitlements: could not record ${feature} — ${error.message}`);
      return null;
    }
    return typeof data === "number" ? data : Number(data ?? 0);
  } catch (e) {
    console.error(`entitlements: could not record ${feature} —`, e);
    return null;
  }
}

/** The cheapest tier whose allowance for this feature beats `current`. */
function requiredPlanFor(feature: UsageFeature, current?: PlanId): PlanId {
  const quotaKey = QUOTA_FOR_FEATURE[feature];
  const currentLimit = current ? limitOf(current, quotaKey) : 0;

  for (const id of ["free", "pro", "elite"] as PlanId[]) {
    const limit = limitOf(id, quotaKey);
    if (isUnlimited(limit)) return id;
    if (isUnlimited(currentLimit)) continue;
    if (limit > (typeof currentLimit === "number" ? currentLimit : 0)) return id;
  }
  return "elite";
}

/**
 * The shared 402, the way `rateLimited()` centralises the 429.
 *
 * One shape everywhere means the client can render a real upgrade prompt —
 * naming the feature, the tier that unlocks it and the usage so far — instead
 * of a generic failure that leaves a farmer guessing whether the app is broken
 * or they have simply run out.
 *
 * 402 Payment Required is the honest status here even though nothing is
 * charged: the request was understood, permitted by authentication, and
 * refused on entitlement. 403 would say the farmer may never do this.
 */
export function planDenied(guard: Extract<Guard, { ok: false }>): Response {
  const planName = PLANS[guard.requiredPlan].id;
  const body = {
    error:
      guard.reason === "plan"
        ? `This is included from ${planName} upwards.`
        : `You have used all ${guard.limit} this month.`,
    reason: guard.reason,
    feature: guard.feature,
    plan: guard.plan,
    requiredPlan: guard.requiredPlan,
    used: guard.used,
    limit: guard.limit,
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * How many fields a plan allows, and whether a farmer is already over it.
 *
 * Used by the fields step during onboarding, by `AddFarmModal`, and by the
 * downgrade guard on /api/plan. A farmer is never truncated to fit a plan —
 * see the route for why.
 */
export function fieldsWithin(plan: PlanId, count: number): boolean {
  return count <= PLANS[plan].limits.fields;
}

/**
 * The oldest date a tier can still see, or null for no limit.
 *
 * This is the honest version of the spec's "historical analytics": the app
 * stores every scan and expense regardless of tier, and the window governs how
 * far back they are shown. Nothing is deleted when a farmer downgrades.
 */
export function historyCutoff(plan: PlanId, now: Date = new Date()): Date | null {
  const days = limitOf(plan, "historyDays");
  if (isUnlimited(days)) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
