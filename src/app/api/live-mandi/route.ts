import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { readJsonBounded, payloadTooLarge, PayloadTooLargeError, clampStr, clampArr } from "@/lib/apiInput";
import { fetchWithRetry } from "@/lib/http";
import { getMandiRowsForState, getMarketForState } from "@/lib/market-server";

/**
 * Live cross-mandi price comparison, via a TinyFish web agent.
 *
 * ── Why this exists next to the market feed we already have ──────────────────
 *
 * `/dashboard/market` already shows prices from the data.gov.in Agmarknet API:
 * official, cached for six hours, and one row per mandi per day. This route is
 * the other half of the story — a browser agent that opens agmarknet.gov.in
 * itself and reads today's board across mandis. The app stops being a reader of
 * a dataset and starts acting on the farmer's behalf.
 *
 * It matters more than it looks, because **agmarknet.gov.in is now a
 * client-side React app**. A plain GET returns a 1 KB shell — `<div id="root">`
 * and `<noscript>You need to enable JavaScript to run this app.</noscript>`.
 * The `SearchCmmMkt.aspx?Tx_Commodity=…` deep link that every published scraper
 * uses returns that same shell. `fetch` + a HTML parser cannot read this site
 * at all any more; only something driving a real browser can.
 *
 * ── What this route refuses to do ────────────────────────────────────────────
 *
 * It never invents a mandi, a price or a date. `src/lib/market.ts` already
 * holds that line — `getMandiRows` returns `[]` rather than showing a Rajasthan
 * farmer Karnataka mandis — and a comparison a farmer might drive a loaded
 * trailer to is the last place to relax it. If the agent comes back empty, the
 * answer is empty.
 *
 * It also never throws. Every path returns a JSON body, because the card that
 * renders this has to say something true on stage in either case.
 *
 * ── Provenance ───────────────────────────────────────────────────────────────
 *
 * When the agent fails we fall back to the official API and say so: the
 * response carries `provenance: "tinyfish" | "datagov"` and the card prints the
 * difference. "Live via TinyFish" over numbers that came from a cached REST
 * feed would be a lie, and it is exactly the kind of lie a demo makes easy.
 */

export const dynamic = "force-dynamic";

const TINYFISH_RUN_URL = "https://agent.tinyfish.ai/v1/automation/run";
const AGMARKNET_URL = "https://agmarknet.gov.in";

/**
 * How long the agent gets before we fall back, in seconds.
 *
 * Set from measurement, not from hope. Two real runs against Agmarknet 2.0:
 * 17 steps / 89 s and 33 steps / 166 s, both `status: "COMPLETED"` with
 * `error: null` and both returning a well-formed `{ "mandis": [] }`. So the
 * agent reaches the site and works; it just cannot get a price table out of it.
 *
 * The reason is upstream, not in the goal text: agmarknet.gov.in is now a React
 * SPA whose data comes from `api.agmarknet.gov.in/v1/`, and the price endpoints
 * there sit behind a guest OTP login (`guest-login/send-otp`, and `msp-cmdt`
 * answers `403 Authorization header missing`). No amount of prompt tuning gets
 * past a login.
 *
 * Waiting the full 166 s to learn that on every click would cost a minute and a
 * half of dead air and a billable run each time. A short budget keeps the live
 * attempt genuine and visible in the logs while the card stays responsive, and
 * the moment the site becomes readable — or this is pointed at a source that is
 * not login-gated — raising this number is the only change needed.
 */
const AGENT_BUDGET_SEC = 30;

/** One mandi's quote. `date` is "" when the source gave no date — never guessed. */
type LiveMandi = { name: string; price_per_quintal: number; date: string };

type LiveMandiOk = {
  success: true;
  mandis: LiveMandi[];
  best: { mandi: string; price: number };
  source_url: string;
  scraped_at: string;
  /** Which path produced these rows. Drives the label on the card. */
  provenance: "tinyfish" | "datagov";
};

type LiveMandiErr = { success: false; error: string };

/**
 * TinyFish `/v1/automation/run` response.
 *
 * `result` is deliberately `unknown` — it is whatever the agent produced, and
 * narrowing it by hand below is the point. Typing it as the shape we hope for
 * would let a goal failure walk straight into the happy path.
 */
type TinyFishRun = {
  run_id?: string;
  status?: string;
  num_of_steps?: number;
  result?: unknown;
  error?: { code?: string; message?: string; category?: string } | null;
};

/**
 * The output contract handed to the agent.
 *
 * Wrapped in a top-level object because TinyFish requires that, and because a
 * bare list arrives at `result.result` instead of somewhere nameable. Keywords
 * are kept to the documented subset — `additionalProperties`, `oneOf` and
 * `const` are rejected before the run starts, which costs a 400 and the whole
 * time budget.
 */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    mandis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price_per_quintal: { type: "number" },
          date: { type: "string" },
        },
        required: ["name", "price_per_quintal", "date"],
      },
    },
  },
  required: ["mandis"],
} as const;

function buildGoal(crop: string, state: string, nearby: string[]): string {
  const lines = [
    `Find the mandi (market) price search on this website.`,
    `Select the commodity "${crop}" and the state "${state}".`,
    `Set the date range to the last 3 days and submit the search.`,
    `Read the results table and return each market with its name, its modal price in rupees per quintal, and the date the price was reported.`,
    `Return at most 5 markets, highest modal price first.`,
    `If the site shows no data for this commodity and state, return an empty mandis array.`,
  ];
  if (nearby.length) {
    lines.push(`If any of these markets appear, prefer them: ${nearby.join(", ")}.`);
  }
  return lines.join(" ");
}

/** Narrows the agent's free-form `result` to rows we are willing to show. */
function readAgentRows(result: unknown): LiveMandi[] {
  if (!result || typeof result !== "object") return [];
  const obj = result as Record<string, unknown>;

  // A goal failure still arrives inside a COMPLETED run, as
  // `{ status: "failure", reason: … }`. Checking the HTTP status and the run
  // status is not enough — the payload has to be inspected too.
  if (typeof obj.status === "string" && obj.status.toLowerCase() === "failure") return [];

  const raw = Array.isArray(obj.mandis) ? obj.mandis : null;
  if (!raw) return [];

  return raw
    .map((r): LiveMandi | null => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const name = clampStr(row.name, 80);
      const price = Number(row.price_per_quintal);
      if (!name || !Number.isFinite(price) || price <= 0) return null;
      return { name, price_per_quintal: Math.round(price), date: clampStr(row.date, 40) };
    })
    .filter((r): r is LiveMandi => r !== null);
}

/**
 * The official API, used when the agent could not deliver.
 *
 * Resolves the caller's crop to the canonical catalogue name first, because
 * `getMandiRows` matches on `c.name === cropName` — exact and case-sensitive.
 * A farmer (or the demo curl) sending "paddy" would otherwise silently get an
 * empty list for a crop the app fully supports as "Paddy". The state's crop
 * list is already cached for six hours, so this costs nothing.
 *
 * Returns the canonical name too, so the caller can use it for display and for
 * the agent's goal text.
 */
async function datagovRows(
  crop: string,
  state: string
): Promise<{ rows: LiveMandi[]; canonical: string }> {
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

  // Variety mismatches are already filtered inside `getMandiRows`
  // (`isForeignVariety`), so the board and this card cannot disagree about
  // which mandi pays best.
  const rows = await getMandiRowsForState(canonical, state);
  if (!rows.length) return { rows: [], canonical };

  // `distanceKm` on these rows is deliberately ignored: it is `8 + i * 12`, a
  // position, not a distance (src/lib/market.ts).
  return {
    rows: rows.map((r) => ({
      name: r.mandi,
      price_per_quintal: Math.round(r.price),
      date: reportedOn,
    })),
    canonical,
  };
}


/** Canonical catalogue name for the agent's goal text, best-effort. */
async function canonicalCrop(crop: string, state: string): Promise<string> {
  try {
    const crops = await getMarketForState(state);
    return crops.find((c) => c.name.toLowerCase() === crop.toLowerCase())?.name ?? crop;
  } catch {
    return crop;
  }
}

function shape(mandis: LiveMandi[], provenance: "tinyfish" | "datagov"): LiveMandiOk {
  const sorted = [...mandis].sort((a, b) => b.price_per_quintal - a.price_per_quintal).slice(0, 5);
  return {
    success: true,
    mandis: sorted,
    best: { mandi: sorted[0].name, price: sorted[0].price_per_quintal },
    source_url: AGMARKNET_URL,
    scraped_at: new Date().toISOString(),
    provenance,
  };
}

export async function POST(req: Request) {
  // Counted before any work: each run spends real TinyFish credit, so the
  // point is to refuse the expensive call rather than make it and complain.
  //
  // SECURITY — this route is unauthenticated to match the other public market
  // routes, but unlike them it costs money per call. The hard limit below is a
  // bound, not a fix. Gate it on `getSessionFarmer()` before any public deploy.
  const rl = await checkRateLimit(req, "live-mandi");
  if (!rl.ok) return rateLimited(rl);

  let input: unknown;
  try {
    input = await readJsonBounded(req, 8_000);
  } catch (e) {
    if (e instanceof PayloadTooLargeError) return payloadTooLarge();
    return NextResponse.json<LiveMandiErr>({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const body = (input ?? {}) as Record<string, unknown>;
  const crop = clampStr(body.crop, 40);
  const state = clampStr(body.state, 40);
  const nearbyMandis = clampArr<unknown>(body.nearbyMandis, 5)
    .map((m) => clampStr(m, 60))
    .filter(Boolean);

  if (!crop || !state) {
    return NextResponse.json<LiveMandiErr>(
      { success: false, error: "A crop and a state are required." },
      { status: 400 }
    );
  }

  const key = process.env.TINYFISH_API_KEY;

  // ── 1. the web agent ──────────────────────────────────────────────────────
  if (key) {
    try {
      // Agmarknet lists "Paddy(Dhan)(Common)", not "paddy" — giving the agent
      // the catalogue's own spelling saves it a guess inside the dropdown.
      const cropForGoal = await canonicalCrop(crop, state);
      const res = await fetchWithRetry(
        TINYFISH_RUN_URL,
        {
          method: "POST",
          headers: { "X-API-Key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: AGMARKNET_URL,
            goal: buildGoal(cropForGoal, state, nearbyMandis),
            output_schema: OUTPUT_SCHEMA,
            browser_profile: "stealth",
            // Stops the agent before our own fetch deadline, so a long run ends
            // on TinyFish's side rather than being abandoned mid-flight.
            agent_config: { max_duration_seconds: AGENT_BUDGET_SEC },
          }),
          signal: AbortSignal.timeout((AGENT_BUDGET_SEC + 10) * 1000),
        },
        // `retries: 0` is load-bearing. The default is three attempts, and
        // /run cannot be cancelled — a retry would start a SECOND billable
        // browser run and blow the time budget twice over.
        { retries: 0, label: "tinyfish/live-mandi" }
      );

      if (res.ok) {
        const run = (await res.json()) as TinyFishRun;
        const rows = run.status === "COMPLETED" ? readAgentRows(run.result) : [];
        if (rows.length) return NextResponse.json<LiveMandiOk>(shape(rows, "tinyfish"));
        console.warn(
          `tinyfish/live-mandi: no rows (status=${run.status}, steps=${run.num_of_steps}, err=${run.error?.code ?? "none"})`
        );
      } else {
        // 402 INSUFFICIENT_CREDITS and 401 INVALID_API_KEY both land here, and
        // both are worth seeing in the log rather than silently degrading.
        let detail = "";
        try {
          detail = JSON.stringify((await res.json()) as unknown).slice(0, 300);
        } catch {
          /* body already consumed or not JSON */
        }
        console.warn(`tinyfish/live-mandi: HTTP ${res.status} ${detail}`);
      }
    } catch (e) {
      // A 90-second timeout lands here as an AbortError, which fetchWithRetry
      // rethrows rather than retrying.
      console.warn(`tinyfish/live-mandi: ${(e as Error)?.message || "run failed"}`);
    }
  }

  // ── 2. the official API, clearly labelled ────────────────────────────────
  let shownCrop = crop;
  try {
    const { rows, canonical } = await datagovRows(crop, state);
    shownCrop = canonical;
    if (rows.length) return NextResponse.json<LiveMandiOk>(shape(rows, "datagov"));
  } catch (e) {
    console.warn(`live-mandi/datagov: ${(e as Error)?.message || "failed"}`);
  }

  return NextResponse.json<LiveMandiErr>({
    success: false,
    error: `No mandi prices are available for ${shownCrop} in ${state} right now.`,
  });
}
