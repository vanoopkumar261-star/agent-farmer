import "server-only";
import { hazardAdmin } from "@/lib/hazards/store";
import { anyKeyConfigured } from "@/lib/tfKeys";
import {
  formatLadder,
  newBudget,
  tfAgentPoll,
  tfAgentStart,
  tfFetch,
  type TfBudget,
  type TfRungLog,
} from "@/lib/tinyfish";
import {
  acropUrl,
  mandipulseUrl,
  retailUrl,
  siteById,
  type MandiSite,
} from "./sites";

/**
 * Cross-mandi price comparison.
 *
 * ── What this replaced ───────────────────────────────────────────────────────
 *
 * This feature existed before and did not work. /api/live-mandi drove a browser
 * agent at agmarknet.gov.in; two measured runs (17 steps/89 s, 33 steps/166 s)
 * both completed and both returned `{"mandis": []}`, because Agmarknet 2.0 is a
 * React SPA whose price endpoints sit behind a guest OTP. Every attempt cost
 * money and fell through to the data.gov.in REST feed, so the thing being
 * demonstrated was the fallback.
 *
 * ── The ladder, from measurement ─────────────────────────────────────────────
 *
 * Fetch (free) reads mandipulse.com/mandi-bhav/<state>/<crop> in about 200 ms
 * and returns the whole summary and every row's min/modal/max — but the
 * markdown drops the mandi-name column, leaving prices nobody can act on. A
 * browser run against that same URL returns the names. So the paid rung here
 * does exactly one job: recover the names the free rung provably lost, on a
 * page the free rung has already read in this same request.
 *
 * That also gives an unusually strong validator. Because the two tiers read the
 * same table, every agent row's modal price must appear in the free markdown —
 * `validateRows` drops any row that does not. A farmer may drive a loaded
 * trailer to one of these mandis; a hallucinated name on a real price would be
 * the worst failure this app could have.
 *
 * ── Honesty about the upstream ───────────────────────────────────────────────
 *
 * MandiPulse and ACROP both state that they republish AgMarkNet (data.gov.in)
 * records — the same upstream `getMandiRowsForState` already reads. They are
 * therefore not independent corroboration and the UI must not imply they are.
 * What they genuinely add is the cross-mandi roll-up, the named high and low,
 * and mandi names the REST feed's state query does not conveniently give.
 */

export type MandiQuote = {
  mandi: string;
  district: string;
  minInr: number | null;
  modalInr: number;
  maxInr: number | null;
  date: string;
  /** Which tier produced this row, so the card can show it. */
  tier: "fetch" | "agent";
};

export type MandiRollup = {
  rangeMinInr: number | null;
  rangeMaxInr: number | null;
  avgModalInr: number | null;
  medianModalInr: number | null;
  reportingMandis: number | null;
  reportingDistricts: number | null;
  reportDate: string;
  highest: { mandi: string; priceInr: number } | null;
  lowest: { mandi: string; priceInr: number } | null;
};

export type RetailQuote = {
  item: string;
  wholesaleInrPerKg: number;
  retailLowInrPerKg: number | null;
  retailHighInrPerKg: number | null;
};

export type MandiMiss = { sourceId: string; label: string; reason: string };

export type MandiReport = {
  crop: string;
  state: string;
  rollup: MandiRollup | null;
  mandis: MandiQuote[];
  retail: RetailQuote | null;
  missing: MandiMiss[];
  provenance: "cache" | "fetch" | "agent" | "mixed" | "none";
  ladder: TfRungLog[];
  costUsd: number;
  checkedAt: string;
  /**
   * Set when a browser run is in flight. The caller hands this to the client,
   * which polls `collectLiveMandi`. The run outlives the request that started
   * it, which is the only arrangement where a platform timeout cannot destroy
   * work the wallet has already paid for.
   */
  pendingRunId?: string;
};

/** Mandi boards move daily, but not within a trading day. */
const CACHE_TTL_SEC = 8 * 60 * 60;

/**
 * How long an answer that is missing its mandi names is kept.
 *
 * Short on purpose. Caching a names-less result for the full eight hours would
 * mean the next request is a cache hit, the agent rung never runs again, and
 * the names could not arrive until tomorrow — the cache would be preserving
 * the very gap the paid rung exists to close.
 */
const PARTIAL_TTL_SEC = 30 * 60;

/**
 * How long the browser gets.
 *
 * Measured durations for this exact job: 36 s, 45 s, 57 s, with queue time
 * alone ranging from 2 s to 23 s. Because the run is started and collected
 * across separate requests, this no longer has to fit inside one function —
 * it only has to stop a pathological run from billing indefinitely.
 */
const AGENT_BUDGET_SEC = 90;

/** Below this many named mandis, the free rung has not produced an actionable table. */
const SUFFICIENT_NAMED = 3;

/** Guards against a stray "1" or a page-number being read as a rupee figure. */
const MIN_PRICE = 50;
const MAX_PRICE = 500_000;

function now(): string {
  return new Date().toISOString();
}

function cacheKey(crop: string, state: string): string {
  return `v1:${crop.toLowerCase()}:${state.toLowerCase()}`;
}

/**
 * Tidies a mandi name read off the page.
 *
 * Two real artefacts, both observed. MandiPulse's "lowest" sentence is the
 * second half of "X recorded the highest ..., while Y recorded the lowest",
 * so a capture of Y arrives with the conjunction attached. And one browser run
 * returned "Nanjangud APMC Mandi Price" where another returned "Nanjangud
 * APMC" — the page's own heading text bleeding into the cell.
 */
function cleanMandiName(raw: string): string {
  return raw
    .trim()
    .replace(/^while\s+/i, "")
    .replace(/\s+Mandi\s+Price$/i, "")
    .trim();
}

function num(raw: unknown): number | null {
  const n = Number(String(raw ?? "").replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n >= MIN_PRICE && n <= MAX_PRICE ? n : null;
}

// ─── Parsing the free tier ───────────────────────────────────────────────────

/**
 * Reads MandiPulse's summary block and insight line.
 *
 * Deliberately regex over the markdown rather than a model: these are numbers a
 * farmer may act on, and a model asked to "extract the summary" will happily
 * round, convert or infer one that was never printed.
 */
function parseMandipulseRollup(text: string): MandiRollup | null {
  const pick = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1] : null;
  };

  const range = text.match(/₹([\d,]+)\s*[–-]\s*₹([\d,]+)\s*per quintal/);
  const avg = pick(/Average modal price\s*\n+\s*₹([\d,]+)/);
  const median = pick(/Median modal price\s*\n+\s*₹([\d,]+)/);
  const mandis = pick(/Reporting mandis\s*\n+\s*(\d+)/);
  const districts = pick(/Reporting districts\s*\n+\s*(\d+)/);
  const reportDate = pick(/\*\*Report date:\*\*\s*(.+)/)?.trim() ?? "";

  // "Nanjangud APMC recorded the highest modal price at ₹4,166, while
  //  Bangarpet APMC recorded the lowest at ₹800."
  const hi = text.match(/([A-Z][^.\n]*?)\s+recorded the highest modal price at\s+₹([\d,]+)/);
  const lo = text.match(/([^,\n]+?)\s+recorded the lowest at\s+₹([\d,]+)/);

  const anything =
    range || avg || median || mandis || reportDate || hi || lo;
  if (!anything) return null;

  const hiPrice = hi ? num(hi[2]) : null;
  const loPrice = lo ? num(lo[2]) : null;

  return {
    rangeMinInr: range ? num(range[1]) : null,
    rangeMaxInr: range ? num(range[2]) : null,
    avgModalInr: avg ? num(avg) : null,
    medianModalInr: median ? num(median) : null,
    reportingMandis: mandis ? Number(mandis) : null,
    reportingDistricts: districts ? Number(districts) : null,
    reportDate,
    highest: hi && hiPrice ? { mandi: cleanMandiName(hi[1]), priceInr: hiPrice } : null,
    lowest: lo && loPrice ? { mandi: cleanMandiName(lo[1]), priceInr: loPrice } : null,
  };
}

/**
 * ACROP's roll-up, used only to fill gaps MandiPulse left.
 *
 * Both republish AgMarkNet, so this is a second reading of one source rather
 * than a second source. It is here because the two sites lose different fields
 * to rendering, not because agreement between them proves anything.
 */
function parseAcropRollup(text: string): Partial<MandiRollup> {
  const median = text.match(/₹([\d,]+)\s*\/\s*quintal/);
  const count = text.match(/Median of (\d+) reporting mandis/);
  const lo = text.match(/\*\*Lowest mandi modal price\*\*:\s*₹([\d,]+)\/quintal\s*·\s*(.+)/);
  const hi = text.match(/\*\*Highest mandi modal price\*\*:\s*₹([\d,]+)\/quintal\s*·\s*(.+)/);

  const loPrice = lo ? num(lo[1]) : null;
  const hiPrice = hi ? num(hi[1]) : null;

  return {
    medianModalInr: median ? num(median[1]) : null,
    reportingMandis: count ? Number(count[1]) : null,
    lowest: lo && loPrice ? { mandi: cleanMandiName(lo[2]), priceInr: loPrice } : null,
    highest: hi && hiPrice ? { mandi: cleanMandiName(hi[2]), priceInr: hiPrice } : null,
  };
}

/**
 * Finds this crop's row in the retail table.
 *
 * The table is per-kilogram retail and the mandi rows are per-quintal
 * wholesale, which is the whole point: it is the only place in the app where
 * the two sides of the same vegetable can be compared.
 */
function parseRetail(text: string, crop: string): RetailQuote | null {
  const want = crop.toLowerCase();
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // |  | Tomato | ₹41 | ₹45 - 53 | 1kg |
    const name = cells[2]?.toLowerCase() ?? "";
    if (!name || !(name === want || name.startsWith(want + " ") || want.startsWith(name))) continue;

    const wholesale = Number(String(cells[3] ?? "").replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(wholesale) || wholesale <= 0) continue;

    const retail = String(cells[4] ?? "").match(/₹?([\d,]+)\s*-\s*([\d,]+)/);
    return {
      item: cells[2],
      wholesaleInrPerKg: wholesale,
      retailLowInrPerKg: retail ? Number(retail[1].replace(/,/g, "")) : null,
      retailHighInrPerKg: retail ? Number(retail[2].replace(/,/g, "")) : null,
    };
  }
  return null;
}

/**
 * Pulls whatever priced rows the free markdown still contains.
 *
 * MandiPulse's table loses the name column in rendering, so most rows arrive
 * with a district where the mandi should be and one fewer cell than the header
 * promises. Those rows are NOT emitted as named quotes — a price attributed to
 * the wrong market is worse than no price. They are counted, because the count
 * is the evidence that justifies escalating to the browser.
 */
function parseFetchRows(text: string): { named: MandiQuote[]; pricedRows: number } {
  const named: MandiQuote[] = [];
  let pricedRows = 0;

  for (const line of text.split("\n")) {
    if (!line.startsWith("|") || !line.includes("₹")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter((c, i, a) => !(i === 0 || i === a.length - 1));
    if (cells.length < 6) continue;
    if (!/^\d+$/.test(cells[0])) continue; // skip the header and separator

    const prices = cells.filter((c) => c.includes("₹")).map((c) => num(c.replace(/\*\*/g, "")));
    const modal = prices.length >= 2 ? prices[1] : prices[0];
    if (modal == null) continue;
    pricedRows += 1;

    // A full row still carries its name. Header is:
    // S.No | Mandi | District | Variety | Grade | Min | Modal | Max | Date
    const looksComplete = cells.length >= 9;
    if (!looksComplete) continue;

    const mandi = cells[1];
    if (!mandi || mandi.includes("₹")) continue;
    named.push({
      mandi,
      district: cells[2] ?? "",
      minInr: prices[0] ?? null,
      modalInr: modal,
      maxInr: prices[2] ?? null,
      date: cells[cells.length - 1] ?? "",
      tier: "fetch",
    });
  }

  return { named, pricedRows };
}

// ─── The paid rung's validator ───────────────────────────────────────────────

/**
 * One wording, used when starting a run and quoted in the ladder.
 *
 * The emphasis on the name column is not decoration: the free tier already
 * returns every price on this page, so a run that comes back without names has
 * achieved nothing and still billed.
 */
function agentGoal(crop: string): string {
  return (
    `Read the "Mandi-wise ${crop} rates" table on this page. For every row, extract the ` +
    `mandi name, the district, and the minimum, modal and maximum price in rupees per ` +
    `quintal as numbers, plus the report date. The mandi name is essential: capture it ` +
    `exactly as displayed, without adding words like "Mandi Price". Return only rows ` +
    `actually present in the table.`
  );
}

const AGENT_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mandi: { type: "string" },
          district: { type: "string" },
          min_inr: { type: "number" },
          modal_inr: { type: "number" },
          max_inr: { type: "number" },
          date: { type: "string" },
        },
        required: ["mandi", "modal_inr", "date"],
      },
    },
  },
  required: ["rows"],
};

/**
 * Keeps only agent rows the free tier corroborates.
 *
 * Both tiers read the same table in the same request, so every genuine modal
 * price the agent reports is already present in `sourceText`. A row whose price
 * is absent was invented or misread, and is dropped. This is a code-level
 * check, not a line in the prompt, for the same reason the scheme desk
 * validates link hosts in code: prompts are requests, validators are rules.
 */
function validateRows(result: unknown, sourceText: string): MandiQuote[] | null {
  if (!result || typeof result !== "object") return null;
  const rows = (result as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return null;

  // Digits only, so ₹4,166 in the source matches 4166 from the agent.
  const sourceDigits = sourceText.replace(/[,\s]/g, "");

  const out: MandiQuote[] = [];
  const seen = new Set<string>();

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;

    const mandi = cleanMandiName(String(r.mandi ?? ""));
    const modal = num(r.modal_inr);
    if (!mandi || modal == null) continue;

    if (!sourceDigits.includes(String(modal))) {
      console.warn(`tf/live-mandi: dropped "${mandi}" — ₹${modal} is not on the page`);
      continue;
    }

    const dedupe = mandi.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push({
      mandi,
      district: String(r.district ?? "").trim(),
      minInr: num(r.min_inr),
      modalInr: modal,
      maxInr: num(r.max_inr),
      date: String(r.date ?? "").trim(),
      tier: "agent",
    });
  }

  return out.length > 0 ? out : null;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

type CacheRow = {
  rollup: MandiRollup | null;
  mandis: MandiQuote[];
  retail: RetailQuote | null;
  missing: MandiMiss[];
  ladder: TfRungLog[];
  provenance: MandiReport["provenance"];
  cost_usd: number;
  checked_at: string;
};

async function readCache(crop: string, state: string): Promise<MandiReport | null> {
  const db = hazardAdmin();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("mandi_cache")
      .select("rollup, mandis, retail, missing, ladder, provenance, cost_usd, checked_at")
      .eq("key", cacheKey(crop, state))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;

    const row = data as CacheRow;
    return {
      crop,
      state,
      rollup: row.rollup ?? null,
      mandis: Array.isArray(row.mandis) ? row.mandis : [],
      retail: row.retail ?? null,
      missing: Array.isArray(row.missing) ? row.missing : [],
      provenance: "cache",
      ladder: Array.isArray(row.ladder) ? row.ladder : [],
      costUsd: 0,
      checkedAt: row.checked_at,
    };
  } catch {
    // Before migration 034 this is simply a miss, never an error.
    return null;
  }
}

async function writeCache(report: MandiReport, ttlSec = CACHE_TTL_SEC): Promise<void> {
  const db = hazardAdmin();
  if (!db) return;
  try {
    const { error } = await db.from("mandi_cache").upsert(
      {
        key: cacheKey(report.crop, report.state),
        crop: report.crop,
        state: report.state,
        rollup: report.rollup,
        mandis: report.mandis,
        retail: report.retail,
        missing: report.missing,
        ladder: report.ladder,
        provenance: report.provenance,
        cost_usd: report.costUsd,
        checked_at: report.checkedAt,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      },
      { onConflict: "key" }
    );
    // Logged, not thrown. A cache that cannot be written still returns a
    // correct answer — but a silent failure here looks identical to "nothing
    // worth caching", which once hid 27 missing rows behind a clean report.
    if (error) console.warn(`tf/live-mandi: cache write failed — ${error.message}`);
  } catch (e) {
    console.warn(`tf/live-mandi: cache write threw — ${(e as Error)?.message}`);
  }
}

function empty(crop: string, state: string, missing: MandiMiss[]): MandiReport {
  return {
    crop,
    state,
    rollup: null,
    mandis: [],
    retail: null,
    missing,
    provenance: "none",
    ladder: [],
    costUsd: 0,
    checkedAt: now(),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Cache-or-nothing. Never calls TinyFish, so it is safe on mount. */
export async function readLiveMandi(crop: string, state: string): Promise<MandiReport> {
  const cached = await readCache(crop, state);
  if (cached) return cached;
  return empty(crop, state, []);
}

/**
 * Climbs the ladder. Billable, so callers must gate this on a user action.
 */
export async function startLiveMandi(
  crop: string,
  state: string,
  opts: { allowAgent: boolean; budget: TfBudget; ownerId: string }
): Promise<MandiReport> {
  if (!anyKeyConfigured()) return empty(crop, state, []);

  // A cached answer that never got its mandi names does not satisfy a caller
  // willing to pay for them. Without this the nightly warm job — which runs
  // the free rungs only — would park a names-less entry in the cache and the
  // browser rung could not run again until it expired.
  const cached = await readCache(crop, state);
  if (cached && (cached.mandis.length > 0 || !opts.allowAgent)) return cached;

  const ladder: TfRungLog[] = [];
  const missing: MandiMiss[] = [];
  let costUsd = 0;

  const pulseUrl = mandipulseUrl(crop, state);

  // ── Rung 1: Fetch (free) ───────────────────────────────────────────────────
  let t0 = Date.now();
  const { pages, errors } = await tfFetch([pulseUrl, acropUrl(crop, state), retailUrl(state)], {
    ttl: 1800,
    timeoutMs: 25_000,
    label: "tf/live-mandi",
  });

  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const pulse = byUrl.get(pulseUrl);
  const acrop = byUrl.get(acropUrl(crop, state));
  const veg = byUrl.get(retailUrl(state));

  let rollup = pulse ? parseMandipulseRollup(pulse.text) : null;
  if (acrop) {
    const extra = parseAcropRollup(acrop.text);
    // MandiPulse first where both have a field; ACROP only fills gaps. Picking
    // between two readings of the same upstream would be a coin toss dressed
    // up as a decision.
    rollup = {
      rangeMinInr: rollup?.rangeMinInr ?? null,
      rangeMaxInr: rollup?.rangeMaxInr ?? null,
      avgModalInr: rollup?.avgModalInr ?? null,
      medianModalInr: rollup?.medianModalInr ?? extra.medianModalInr ?? null,
      reportingMandis: rollup?.reportingMandis ?? extra.reportingMandis ?? null,
      reportingDistricts: rollup?.reportingDistricts ?? null,
      reportDate: rollup?.reportDate ?? "",
      highest: rollup?.highest ?? extra.highest ?? null,
      lowest: rollup?.lowest ?? extra.lowest ?? null,
    };
  }

  const fetched = pulse ? parseFetchRows(pulse.text) : { named: [], pricedRows: 0 };
  let mandis: MandiQuote[] = fetched.named;
  const retail = veg ? parseRetail(veg.text, crop) : null;

  for (const e of errors) {
    const host = e.url.includes("mandipulse")
      ? "mandipulse"
      : e.url.includes("acrop")
        ? "acrop"
        : "vegmarket";
    const site = siteById(host);
    missing.push({
      sourceId: host,
      label: site?.label ?? host,
      reason: `Could not be read (${e.error}${e.status ? ` ${e.status}` : ""})`,
    });
  }

  ladder.push({
    tier: "fetch",
    label: "read price pages",
    ms: Date.now() - t0,
    outcome: rollup || mandis.length ? "hit" : "miss",
    detail:
      `${pages.length}/3 read, ${fetched.pricedRows} priced rows, ` +
      `${mandis.length} named, retail ${retail ? "yes" : "no"}`,
  });

  // ── Rung 2: Agent (paid) ───────────────────────────────────────────────────
  //
  // The gate is provable from the rung above and from this same request: the
  // free read found priced rows on THIS url but could not name them. Without
  // that evidence the browser does not run.
  const namesLost = fetched.pricedRows > 0 && mandis.length < SUFFICIENT_NAMED;
  const canEscalate = opts.allowAgent && namesLost && !!pulse;

  if (!canEscalate) {
    ladder.push({
      tier: "agent",
      label: "recover mandi names",
      ms: 0,
      outcome: "skipped",
      detail: !opts.allowAgent
        ? "not requested"
        : !pulse
          ? "free rung never read the page, so there is nothing to corroborate against"
          : `${mandis.length} names already read for free`,
    });
  } else {
    t0 = Date.now();
    const started = await tfAgentStart({
      url: pulseUrl,
      goal: agentGoal(crop),
      outputSchema: AGENT_SCHEMA,
      browserProfile: "lite",
      maxDurationSeconds: AGENT_BUDGET_SEC,
      budget: opts.budget,
      label: "tf/live-mandi-agent",
    });

    if (started.ok) {
      ladder.push({
        tier: "agent",
        label: "recover mandi names",
        ms: Date.now() - t0,
        outcome: "hit",
        detail: `browser run started (~$${started.estimateUsd.toFixed(3)} ceiling)`,
      });

      const partial: MandiReport = {
        crop,
        state,
        rollup,
        mandis,
        retail,
        missing,
        provenance: rollup || mandis.length ? "fetch" : "none",
        ladder,
        costUsd,
        checkedAt: now(),
        pendingRunId: started.runId,
      };

      await recordRun(started.runId, opts.ownerId, {
        keyIndex: started.keyIndex,
        crop,
        state,
        rollup,
        retail,
        missing,
        ladder,
        sourceText: pulse.text,
      });

      console.info(formatLadder(ladder));
      // Deliberately NOT cached: a report with a run still in flight would
      // freeze the un-named version in place for eight hours and the names
      // would never arrive. The collector writes the cache.
      return partial;
    }

    ladder.push({
      tier: "agent",
      label: "recover mandi names",
      ms: Date.now() - t0,
      outcome: "miss",
      detail: `${started.reason}${started.detail ? `: ${started.detail}` : ""}`,
    });
    missing.push({
      sourceId: "mandipulse",
      label: "MandiPulse mandi names",
      reason: "The page's prices were read, but a browser run could not be started",
    });
  }

  const usedAgent = mandis.some((m) => m.tier === "agent");
  const report: MandiReport = {
    crop,
    state,
    rollup,
    mandis: mandis.sort((a, b) => b.modalInr - a.modalInr),
    retail,
    missing,
    provenance: !rollup && !mandis.length ? "none" : usedAgent ? "agent" : "fetch",
    ladder,
    costUsd,
    checkedAt: now(),
  };

  console.info(formatLadder(ladder));
  if (report.provenance !== "none") {
    // A short TTL only when names were wanted and not obtained. The warm job
    // asks for the free rungs on purpose, so its roll-up is a complete answer
    // to the question it asked and earns the full window.
    const incomplete = opts.allowAgent && report.mandis.length === 0;
    await writeCache(report, incomplete ? PARTIAL_TTL_SEC : CACHE_TTL_SEC);
  }
  return report;
}


// ─── The async half: persist a run, then collect it ──────────────────────────

/**
 * Remembers who started a run and what the free tier had already found.
 *
 * Two jobs. The owner column makes a run id useless to anyone else — it is a
 * bearer token for work somebody paid for. And `source_text` preserves the
 * free markdown so `validateRows` still has something to corroborate the
 * agent's numbers against when the run finishes minutes later, in a different
 * request, on a different instance.
 */
async function recordRun(
  runId: string,
  ownerId: string,
  ctx: {
    keyIndex: number;
    crop: string;
    state: string;
    rollup: MandiRollup | null;
    retail: RetailQuote | null;
    missing: MandiMiss[];
    ladder: TfRungLog[];
    sourceText: string;
  }
): Promise<void> {
  const db = hazardAdmin();
  if (!db) return;
  try {
    await db.from("mandi_runs").insert({
      run_id: runId,
      owner_id: ownerId,
      key_index: ctx.keyIndex,
      cache_key: cacheKey(ctx.crop, ctx.state),
      crop: ctx.crop,
      state: ctx.state,
      rollup: ctx.rollup,
      retail: ctx.retail,
      missing: ctx.missing,
      ladder: ctx.ladder,
      // Capped: the validator only needs the digits, and a whole page in every
      // row would bloat the table for no gain.
      source_text: ctx.sourceText.slice(0, 20_000),
    });
  } catch {
    /* the run still completes; only the merge and the ownership check are lost */
  }
}

type PendingMandiRun = {
  crop: string;
  state: string;
  key_index: number;
  rollup: MandiRollup | null;
  retail: RetailQuote | null;
  missing: MandiMiss[];
  ladder: TfRungLog[];
  source_text: string;
};

export type MandiCollect =
  | { state: "running" }
  /** Deliberately indistinguishable from "no such run", so ids cannot be probed. */
  | { state: "unknown" }
  | { state: "done"; report: MandiReport };

/**
 * One poll of a run started by `startLiveMandi`.
 */
export async function collectLiveMandi(
  runId: string,
  opts: { budget: TfBudget; ownerId: string }
): Promise<MandiCollect> {
  const db = hazardAdmin();
  if (!db) return { state: "unknown" };

  let run: PendingMandiRun | null = null;
  try {
    const { data } = await db
      .from("mandi_runs")
      .select("crop, state, key_index, rollup, retail, missing, ladder, source_text")
      .eq("run_id", runId)
      .eq("owner_id", opts.ownerId)
      .maybeSingle();
    run = data as PendingMandiRun | null;
  } catch {
    return { state: "unknown" };
  }
  if (!run) return { state: "unknown" };

  const poll = await tfAgentPoll<MandiQuote[]>(runId, {
    budget: opts.budget,
    label: "tf/live-mandi-agent",
    // Only the key that started the run can resolve its id.
    keyIndex: Number(run.key_index) || 0,
    validate: (result) => validateRows(result, run!.source_text),
  });

  if (poll.state === "running") return { state: "running" };

  const ladder: TfRungLog[] = [...(Array.isArray(run.ladder) ? run.ladder : [])];
  const missing: MandiMiss[] = [...(Array.isArray(run.missing) ? run.missing : [])];
  let mandis: MandiQuote[] = [];

  if (poll.state === "done") {
    mandis = poll.data;
    ladder.push({
      tier: "agent",
      label: "browser finished",
      ms: 0,
      outcome: "hit",
      detail: `${poll.steps} steps, ${poll.data.length} named mandis`,
      costUsd: poll.costUsd,
    });
  } else {
    ladder.push({
      tier: "agent",
      label: "browser finished",
      ms: 0,
      outcome: "miss",
      detail: `${poll.reason}${poll.detail ? `: ${poll.detail}` : ""}`,
      costUsd: poll.costUsd,
    });
    missing.push({
      sourceId: "mandipulse",
      label: "MandiPulse mandi names",
      reason: "The page's prices were read, but the browser could not recover the mandi names",
    });
  }

  const report: MandiReport = {
    crop: run.crop,
    state: run.state,
    rollup: run.rollup ?? null,
    mandis: mandis.sort((a, b) => b.modalInr - a.modalInr),
    retail: run.retail ?? null,
    missing,
    provenance: mandis.length ? "agent" : run.rollup ? "fetch" : "none",
    ladder,
    costUsd: poll.costUsd,
    checkedAt: now(),
  };

  console.info(formatLadder(ladder));
  if (report.provenance !== "none") {
    await writeCache(report, report.mandis.length ? CACHE_TTL_SEC : PARTIAL_TTL_SEC);
  }

  // The run is finished either way; leaving the row would let a replayed id
  // re-charge the budget on a second poll.
  try {
    await db.from("mandi_runs").delete().eq("run_id", runId);
  } catch {
    /* harmless: the row expires from relevance, and the cache is already written */
  }

  return { state: "done", report };
}

/**
 * The per-request spend ceiling, checked before a run starts.
 *
 * A 45 s cap prices at ~$0.144 worst case against the measured $0.048, so the
 * default leaves room for one run and refuses a second.
 */
export function mandiBudget(maxUsd = 0.2): TfBudget {
  return newBudget(maxUsd);
}

export type { MandiSite };
