import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import { clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";
import { extractStateFromAddress } from "@/lib/market";
import { readSchemeDesk, refreshSchemeDesk } from "@/lib/schemeDesk";
import { newBudget } from "@/lib/tinyfish";

/**
 * The scheme desk, split by what it costs.
 *
 * GET is a single cached read and never touches TinyFish, so the Schemes page
 * can call it on mount. POST climbs the ladder and may end in a billable
 * browser run, so it only ever happens because a farmer pressed a button.
 *
 * That split is the same one LiveMandiCard established, and it exists because
 * the alternative — refreshing on mount — turns every page view into a spend
 * and every reload into a second one.
 */

export const dynamic = "force-dynamic";

/**
 * Vercel's Hobby ceiling. The agent rung is capped at 45 s rather than 60 so a
 * run finishes inside the function instead of being killed by the platform
 * mid-flight and billed anyway.
 */
export const maxDuration = 60;

/** The hard ceiling on what one refresh may spend. ~12 agent steps. */
const MAX_USD_PER_REQUEST = 0.2;

/** Query/body state if given, else the farmer's own, else national. */
function resolveState(explicit: string, houseAddress: string | null): string | null {
  if (explicit) return explicit;
  return extractStateFromAddress(houseAddress ?? "");
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "schemes");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) return NextResponse.json({ error: "Sign in to see schemes." }, { status: 401 });

  const url = new URL(req.url);
  const state = resolveState(clampStr(url.searchParams.get("state"), 40), farmer.house_address);

  const result = await readSchemeDesk(state);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  // Counted before any work, because the point is to refuse the expensive call
  // rather than make it and then complain.
  const rl = await checkRateLimit(req, "schemes");
  if (!rl.ok) return rateLimited(rl);

  // Gated, unlike the other market-ish routes: this one can spend money.
  const [farmer, user] = await Promise.all([getSessionFarmer(), getSessionUser()]);
  if (!farmer || !user) {
    return NextResponse.json({ error: "Sign in to check for new schemes." }, { status: 401 });
  }

  // The live refresh is Pro and above. The built-in scheme matcher every
  // farmer uses is the GET below and stays open to all tiers — what is sold
  // here is the TinyFish lookup, not knowing that PM-KISAN exists.
  const plan = getPlan(farmer);
  const guard = await checkQuota(user.id, "live_lookup", plan);
  if (!guard.ok) return planDenied(guard);

  let body: Record<string, unknown> = {};
  try {
    body = ((await readJsonBounded(req, 4_000)) ?? {}) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return payloadTooLarge();
    /* malformed JSON — fall through with the empty default */
  }

  const state = resolveState(clampStr(body.state, 40), farmer.house_address);

  // Never throws: refreshSchemeDesk degrades to the built-in catalogue on every
  // failure path, and the board has to say something true either way.
  const result = await refreshSchemeDesk(state, {
    allowAgent: true,
    budget: newBudget(MAX_USD_PER_REQUEST),
  });

  // A cached desk reached nobody, so it spends no allowance.
  if (result.provenance !== "cache") {
    await consumeQuota(user.id, "live_lookup", plan);
  }

  return NextResponse.json(result);
}
