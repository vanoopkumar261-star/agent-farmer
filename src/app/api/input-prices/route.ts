import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import { clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";
import {
  startInputPrices,
  collectInputPrices,
  INPUT_CATEGORIES,
  type InputCategory,
} from "@/lib/inputPrices";
import { newBudget } from "@/lib/tinyfish";

/**
 * Farm-input price comparison, split across two requests because a browser run
 * outlives one.
 *
 *   POST  starts it. Cache, then the free Search and Fetch rungs. If those give
 *         fewer than two quotes it starts a browser run and returns its id
 *         alongside whatever it already has.
 *   GET   polls that id. Returns `running` until the run reaches a terminal
 *         state, then the merged comparison.
 *
 * The alternative — waiting inside the POST — cannot work: measured runs take
 * 70 to 166 seconds against a 60-second function ceiling, so the platform would
 * kill the request while TinyFish kept running and billing.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Higher than the scheme desk's $0.20, and deliberately.
 *
 * A storefront run is capped at 90 seconds because the measured BigHaat run
 * needed over a minute to produce its five products. At ~5 s per step that
 * prices at ~$0.29, so a $0.20 ceiling would refuse every run pre-flight and
 * the paid rung would never fire. This is the real number for one run, with a
 * little room, and `TfBudget` enforces it before anything starts.
 */
const MAX_USD_PER_REQUEST = 0.35;

function readCategory(v: unknown): InputCategory | null {
  return INPUT_CATEGORIES.includes(v as InputCategory) ? (v as InputCategory) : null;
}

export async function POST(req: Request) {
  // Counted before any work: this is one of the three routes that can spend.
  const rl = await checkRateLimit(req, "input-prices");
  if (!rl.ok) return rateLimited(rl);

  const [user, farmer] = await Promise.all([getSessionUser(), getSessionFarmer()]);
  if (!user) return NextResponse.json({ error: "Sign in to compare prices." }, { status: 401 });

  // Shares the live-lookup allowance with the mandi comparison and the scheme
  // refresh — one wallet, one budget.
  const plan = getPlan(farmer);
  const guard = await checkQuota(user.id, "live_lookup", plan);
  if (!guard.ok) return planDenied(guard);

  let body: Record<string, unknown> = {};
  try {
    body = ((await readJsonBounded(req, 4_000)) ?? {}) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return payloadTooLarge();
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const category = readCategory(body.category);
  const term = clampStr(body.term, 60);
  if (!category || !term) {
    return NextResponse.json(
      { error: `A term and a category (${INPUT_CATEGORIES.join(", ")}) are required.` },
      { status: 400 }
    );
  }

  const report = await startInputPrices(
    { category, term },
    { allowAgent: true, budget: newBudget(MAX_USD_PER_REQUEST), ownerId: user.id }
  );

  // Cache hits cost nothing upstream, so they cost no allowance either.
  if (report.provenance !== "cache") {
    await consumeQuota(user.id, "live_lookup", plan);
  }

  return NextResponse.json(report);
}

export async function GET(req: Request) {
  // A separate, much looser budget than POST. One lookup polls up to ~40 times
  // while the browser run finishes; counting those against the spend limit
  // would make a successful lookup rate-limit its own result.
  const rl = await checkRateLimit(req, "input-prices-poll");
  if (!rl.ok) return rateLimited(rl);

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to compare prices." }, { status: 401 });

  const runId = clampStr(new URL(req.url).searchParams.get("runId"), 80);
  if (!runId) return NextResponse.json({ error: "A runId is required." }, { status: 400 });

  // The budget here only records what the finished run cost; the spend decision
  // was already made and enforced when the run was started.
  const result = await collectInputPrices(runId, {
    budget: newBudget(MAX_USD_PER_REQUEST),
    ownerId: user.id,
  });

  if (result.state === "unknown") {
    // Deliberately indistinguishable from "no such run": a run id is a bearer
    // token for work someone paid for, and confirming one exists for another
    // account would leak that.
    return NextResponse.json({ error: "No such run." }, { status: 404 });
  }
  if (result.state === "running") return NextResponse.json({ state: "running" });
  return NextResponse.json({ state: "done", ...result.report });
}
