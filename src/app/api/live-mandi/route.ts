import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import {
  readJsonBounded,
  payloadTooLarge,
  PayloadTooLargeError,
  clampStr,
} from "@/lib/apiInput";
import { getMandiRowsForState, getMarketForState } from "@/lib/market-server";
import {
  collectLiveMandi,
  mandiBudget,
  readLiveMandi,
  startLiveMandi,
  type MandiQuote,
  type MandiReport,
} from "@/lib/mandi/live";
import { mandipulseUrl } from "@/lib/mandi/sites";

/**
 * Live cross-mandi price comparison.
 *
 * ── What this route used to be, and why it changed ───────────────────────────
 *
 * It drove a TinyFish browser agent at agmarknet.gov.in. The agent worked; the
 * site did not yield. Agmarknet 2.0 is a React app whose prices come from
 * `api.agmarknet.gov.in/v1/` behind a guest-OTP login, and two measured runs
 * (17 steps / 89 s and 33 steps / 166 s) both returned `status: "COMPLETED"`
 * with `{"mandis": []}`. Every click cost real credit to produce nothing and
 * then fell through to the data.gov.in REST feed — so what a visitor actually
 * saw demonstrated was the fallback.
 *
 * Deleting that is the point of this rewrite. The measurement is kept here
 * because it is the valuable part: no amount of prompt tuning gets past a
 * login, and a future reader should not spend another $0.53 rediscovering it.
 *
 * ── What replaced it ─────────────────────────────────────────────────────────
 *
 * A measured ladder over sources that do yield, in `src/lib/mandi/live.ts`.
 * Free Fetch reads MandiPulse's state page (~200 ms) for the roll-up and every
 * row's min/modal/max, and a vegetable-market page for retail ₹/kg. The browser
 * runs only to recover the mandi-name column that the free read provably loses
 * — on the same URL, in the same request, measured at 3 steps and 36 s.
 *
 * ── Honesty about the upstream ───────────────────────────────────────────────
 *
 * MandiPulse and ACROP both republish AgMarkNet, the same source the
 * data.gov.in floor below reads. They are a better *view* of it, not an
 * independent one, and `provenance` says which path produced the rows so the
 * card can label them without overclaiming.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One request's spend ceiling, enforced before a run starts.
 *
 * The 90 s duration cap prices at $0.288 worst case (ceil(90/5) x $0.016), so a
 * lower ceiling here refuses the run it is meant to permit — which is exactly
 * what 0.20 did on the first end-to-end test. Measured runs cost $0.048.
 */
const MAX_USD_PER_REQUEST = 0.35;

/** One mandi's quote, in the shape the card has always consumed. */
type LiveMandi = { name: string; price_per_quintal: number; date: string };

type LiveMandiOk = {
  success: true;
  mandis: LiveMandi[];
  best: { mandi: string; price: number };
  source_url: string;
  scraped_at: string;
  /**
   * Which path produced these rows.
   *  fetch  — free tiers alone
   *  agent  — the browser recovered the names
   *  cache  — a previous run of either, inside its 8 h window
   *  datagov— the official REST floor, when the ladder produced nothing
   */
  provenance: "fetch" | "agent" | "cache" | "datagov";
  /** The cross-mandi roll-up. Null when no source gave one. */
  rollup: MandiReport["rollup"];
  /** Wholesale-vs-retail, the one data axis the REST feed cannot provide. */
  retail: MandiReport["retail"];
  spread: { capturedPct: number; mandiInrPerKg: number; retailInrPerKg: number } | null;
  missing: MandiReport["missing"];
  ladder: MandiReport["ladder"];
  costUsd: number;
  /**
   * Present while a browser run is still going. The client polls
   * `GET ?runId=` until it stops coming back.
   */
  pendingRunId?: string;
  /** "running" only ever appears on a poll response. */
  state?: "running" | "done";
};

type LiveMandiErr = { success: false; error: string };

/**
 * How much of the retail price the farmer captures.
 *
 * Only computed when both numbers are real and carry a date, and only from the
 * roll-up's median — using a single mandi's modal price against a statewide
 * retail average would compare two different places. Returns null rather than
 * guessing, because a made-up margin is the kind of number people quote back.
 */
function computeSpread(report: MandiReport): LiveMandiOk["spread"] {
  const median = report.rollup?.medianModalInr;
  const retail = report.retail;
  if (!median || !retail) return null;

  const mandiPerKg = median / 100; // quintal → kg
  const retailMid =
    retail.retailLowInrPerKg != null && retail.retailHighInrPerKg != null
      ? (retail.retailLowInrPerKg + retail.retailHighInrPerKg) / 2
      : retail.wholesaleInrPerKg;
  if (!retailMid || retailMid <= 0) return null;

  return {
    capturedPct: Math.round((mandiPerKg / retailMid) * 100),
    mandiInrPerKg: Math.round(mandiPerKg * 10) / 10,
    retailInrPerKg: Math.round(retailMid * 10) / 10,
  };
}

function toRows(quotes: MandiQuote[]): LiveMandi[] {
  return quotes.map((q) => ({
    name: q.mandi,
    price_per_quintal: Math.round(q.modalInr),
    date: q.date,
  }));
}

function shape(report: MandiReport, crop: string, state: string): LiveMandiOk | null {
  const rows = toRows(report.mandis).slice(0, 8);
  // A roll-up with no named rows is still worth showing — it carries the
  // median and the named high and low — so this is not gated on `rows`.
  if (!rows.length && !report.rollup) return null;

  return {
    success: true,
    mandis: rows,
    best: rows.length
      ? { mandi: rows[0].name, price: rows[0].price_per_quintal }
      : report.rollup?.highest
        ? { mandi: report.rollup.highest.mandi, price: report.rollup.highest.priceInr }
        : { mandi: "", price: 0 },
    source_url: mandipulseUrl(crop, state),
    scraped_at: report.checkedAt,
    provenance: report.provenance === "mixed" ? "agent" : (report.provenance as LiveMandiOk["provenance"]),
    rollup: report.rollup,
    retail: report.retail,
    spread: computeSpread(report),
    missing: report.missing,
    ladder: report.ladder,
    costUsd: report.costUsd,
    ...(report.pendingRunId ? { pendingRunId: report.pendingRunId } : {}),
  };
}

/**
 * The floor: the official REST feed, unchanged and clearly labelled.
 *
 * Nothing above is allowed to take this away. If every live source fails, the
 * card still shows real prices from data.gov.in and says where they came from.
 */
async function datagovShape(crop: string, state: string): Promise<LiveMandiOk | null> {
  let canonical = crop;
  let reportedOn = "";
  try {
    const crops = await getMarketForState(state);
    const hit = crops.find((c) => c.name.toLowerCase() === crop.toLowerCase());
    if (hit) {
      canonical = hit.name;
      // The per-mandi rows carry no date, so the crop's real Agmarknet
      // arrival_date is read here rather than stamped with today's.
      reportedOn = hit.reportedOn ?? "";
    }
  } catch {
    // A missing date is honest; a fabricated one is not.
  }

  const rows = await getMandiRowsForState(canonical, state);
  if (!rows.length) return null;

  // `distanceKm` on these rows is deliberately ignored: it is `8 + i * 12`, a
  // position, not a distance (src/lib/market.ts).
  const sorted = rows
    .map((r) => ({ name: r.mandi, price_per_quintal: Math.round(r.price), date: reportedOn }))
    .sort((a, b) => b.price_per_quintal - a.price_per_quintal)
    .slice(0, 8);

  return {
    success: true,
    mandis: sorted,
    best: { mandi: sorted[0].name, price: sorted[0].price_per_quintal },
    source_url: "https://agmarknet.gov.in",
    scraped_at: new Date().toISOString(),
    provenance: "datagov",
    rollup: null,
    retail: null,
    spread: null,
    missing: [],
    ladder: [],
    costUsd: 0,
  };
}

/** crop + state, validated once for both verbs. */
async function readParams(
  req: Request,
  from: "query" | "body"
): Promise<{ crop: string; state: string } | Response> {
  let crop = "";
  let state = "";

  if (from === "query") {
    const url = new URL(req.url);
    crop = clampStr(url.searchParams.get("crop"), 40);
    state = clampStr(url.searchParams.get("state"), 40);
  } else {
    let input: unknown;
    try {
      input = await readJsonBounded(req, 8_000);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return payloadTooLarge();
      return NextResponse.json<LiveMandiErr>(
        { success: false, error: "Invalid request." },
        { status: 400 }
      );
    }
    const body = (input ?? {}) as Record<string, unknown>;
    crop = clampStr(body.crop, 40);
    state = clampStr(body.state, 40);
  }

  if (!crop || !state) {
    return NextResponse.json<LiveMandiErr>(
      { success: false, error: "A crop and a state are required." },
      { status: 400 }
    );
  }
  return { crop, state };
}

/**
 * GET — the cheap read. Cache or the official floor; never spends.
 *
 * Split out so the card can populate on mount without a billable call, the
 * same arrangement as /api/schemes.
 */
export async function GET(req: Request) {
  // A poll gets its own, far looser budget: the spend already happened when
  // the run was started, and a run takes ~10 polls to finish. Billed against
  // the same key as the POST, a successful lookup rate-limits its own result.
  const isPoll = !!new URL(req.url).searchParams.get("runId");
  const rl = await checkRateLimit(req, isPoll ? "live-mandi-poll" : "live-mandi");
  if (!rl.ok) return rateLimited(rl);

  // Two reads for two jobs: the farmer profile is the gate this route was
  // hardened with, and the auth user id is what owns an in-flight browser run.
  const farmer = await getSessionFarmer();
  const user = await getSessionUser();
  if (!farmer || !user) {
    return NextResponse.json<LiveMandiErr>(
      { success: false, error: "Sign in to see live mandi prices." },
      { status: 401 }
    );
  }

  // A poll of a run this account started. Checked before crop/state, because a
  // poll carries only the run id.
  const runId = clampStr(new URL(req.url).searchParams.get("runId"), 80);
  if (runId) {
    const collected = await collectLiveMandi(runId, {
      budget: mandiBudget(MAX_USD_PER_REQUEST),
      ownerId: user.id,
    });

    if (collected.state === "running") {
      return NextResponse.json({ success: true, state: "running" });
    }
    if (collected.state === "unknown") {
      // 404 for an unknown run and for someone else's run alike: a different
      // answer would confirm that a guessed id exists.
      return NextResponse.json<LiveMandiErr>(
        { success: false, error: "No such run." },
        { status: 404 }
      );
    }

    const done = shape(collected.report, collected.report.crop, collected.report.state);
    if (done) return NextResponse.json<LiveMandiOk>({ ...done, state: "done" });
    return NextResponse.json<LiveMandiErr>(
      { success: false, error: "The browser run returned nothing usable." },
      { status: 200 }
    );
  }

  const params = await readParams(req, "query");
  if (params instanceof Response) return params;
  const { crop, state } = params;

  const cached = await readLiveMandi(crop, state);
  const shaped = shape(cached, crop, state);
  if (shaped) return NextResponse.json<LiveMandiOk>(shaped);

  const floor = await datagovShape(crop, state);
  if (floor) return NextResponse.json<LiveMandiOk>(floor);

  return NextResponse.json<LiveMandiErr>({
    success: false,
    error: `No mandi prices are available for ${crop} in ${state} right now.`,
  });
}

/**
 * POST — climbs the ladder. Billable, so it is a button press, never a mount.
 */
export async function POST(req: Request) {
  // Counted before any work: each run spends real TinyFish credit, so the
  // point is to refuse the expensive call rather than make it and complain.
  const rl = await checkRateLimit(req, "live-mandi");
  if (!rl.ok) return rateLimited(rl);

  // SECURITY — this used to be unauthenticated, to match the other public
  // market routes. Unlike them it starts a billable browser run, which made it
  // the one endpoint where a stranger with the URL could spend money rather
  // than CPU; the rate limit bounded that but did not close it.
  //
  // No UX regression: LiveMandiCard renders on /dashboard/market, already
  // behind auth, and its same-origin fetch sends the session cookie by default.
  const farmer = await getSessionFarmer();
  const user = await getSessionUser();
  if (!farmer || !user) {
    return NextResponse.json<LiveMandiErr>(
      { success: false, error: "Sign in to run a live mandi check." },
      { status: 401 }
    );
  }

  const params = await readParams(req, "body");
  if (params instanceof Response) return params;
  const { crop, state } = params;

  // Pro and above. These three surfaces spend TinyFish credits on every call
  // and share one monthly allowance between them, because they draw on the
  // same wallet — metering them separately would let one Krishi Pro farmer
  // run twenty browser runs on each and cost more than the plan collects.
  const plan = getPlan(farmer);
  const guard = await checkQuota(user.id, "live_lookup", plan);
  if (!guard.ok) return planDenied(guard);

  const budget = mandiBudget(MAX_USD_PER_REQUEST);
  const report = await startLiveMandi(crop, state, {
    allowAgent: true,
    budget,
    ownerId: user.id,
  });
  // A cache hit reached no third party and spent nothing, so it costs no
  // allowance. Metering it would charge a farmer for a database read and make
  // the number in Settings describe something other than live lookups.
  if (report.provenance !== "cache") {
    await consumeQuota(user.id, "live_lookup", plan);
  }

  const shaped = shape(report, crop, state);
  if (shaped) return NextResponse.json<LiveMandiOk>(shaped);

  // Every live source failed. The official feed is still real data, and saying
  // so beats an empty card.
  const floor = await datagovShape(crop, state);
  if (floor) {
    return NextResponse.json<LiveMandiOk>({ ...floor, missing: report.missing, ladder: report.ladder });
  }

  return NextResponse.json<LiveMandiErr>({
    success: false,
    error: `No mandi prices are available for ${crop} in ${state} right now.`,
  });
}

export type { LiveMandiOk, LiveMandiErr };
