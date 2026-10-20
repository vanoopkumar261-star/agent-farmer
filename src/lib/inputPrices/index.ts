import "server-only";
import { hazardAdmin } from "@/lib/hazards/store";
import { INPUT_SITES, siteById, type InputSite } from "@/lib/inputPrices/sites";
import {
  tfSearch,
  tfFetch,
  tfAgentStart,
  tfAgentPoll,
  hostOf,
  slug,
  type TfBudget,
  type TfRungLog,
} from "@/lib/tinyfish";

/**
 * Farm-input price comparison.
 *
 * ── Why this is the feature the paid tier belongs to ─────────────────────────
 *
 * A farmer buying urea or seed has no way to compare what the online stores are
 * charging, because none of them has an API and several of them do not render
 * a price into their HTML at all. `scripts/probe-input-sites.mjs` measured it:
 *
 *   AgriBegri    13 198 chars, 240 rupee amounts  → free Fetch tier is enough
 *   BigHaat       1 449 chars,   0 rupee amounts  → listing built in the browser
 *   BadiKheti     5 060 chars,   2 rupee amounts  → listing built in the browser
 *   IFFCO Bazar   no listing page reachable       → never called
 *   Kisanekart    no listing page reachable       → never called
 *
 * BigHaat was then confirmed from the other side: a browser run against the
 * same URL Fetch reads as "No products found" returned five real products with
 * prices and working links. So here, unlike the scheme desk, the paid rung
 * genuinely reaches something the free rungs cannot — and it only runs for the
 * sites the probe marked, for the request that measured the free tiers coming
 * up short.
 *
 * ── Why it is asynchronous ───────────────────────────────────────────────────
 *
 * Those runs take 70–166 seconds and a serverless function is killed at 60. So
 * `start()` runs the free rungs, and if they fall short, starts an agent run
 * and hands back its id. `collect()` is the poll. The run outlives the request,
 * which is the only arrangement where the platform's timeout cannot kill work
 * the wallet has already been charged for.
 *
 * ── Never a price we did not see ─────────────────────────────────────────────
 *
 * A price is only kept if the exact string appears in the page we read. A model
 * that is asked to pick the selling price from a listing will, when it cannot
 * find one, produce a plausible number instead — and a farmer comparing ₹266
 * against ₹310 deserves both to be real. The deterministic regex does the
 * extraction; nothing is inferred.
 */

export type InputCategory = "seed" | "fertiliser" | "pesticide";

export const INPUT_CATEGORIES: InputCategory[] = ["seed", "fertiliser", "pesticide"];

export type InputPriceRow = {
  siteId: string;
  siteLabel: string;
  productName: string;
  priceInr: number;
  /** As printed on the page — "45 kg bag", "1 L". "" when not stated. */
  unit: string;
  url: string;
  tier: "search" | "fetch" | "agent";
};

/** A site that produced nothing, named with the reason. Never hidden. */
export type InputPriceMiss = { siteId: string; siteLabel: string; reason: string };

export type InputPriceReport = {
  category: InputCategory;
  term: string;
  rows: InputPriceRow[];
  missing: InputPriceMiss[];
  provenance: "cache" | "search" | "fetch" | "agent" | "mixed";
  ladder: TfRungLog[];
  costUsd: number;
  checkedAt: string;
  /** Set when a browser run is still in flight. The client polls with it. */
  pendingRunId?: string;
  pendingSite?: string;
};

/**
 * Thirty-six hours. These prices move daily at most, and a warm cache is
 * instant.
 *
 * Widened from 12 h when the nightly warm job landed: a window shorter than
 * the 24 h refresh cycle guarantees the cache is cold for part of every day,
 * which is the opposite of what warming is for.
 */
const CACHE_TTL_SEC = 36 * 60 * 60;

/** Enough quotes to be a comparison rather than a single number. */
const SUFFICIENT_ROWS = 2;

/**
 * 90 seconds.
 *
 * Longer than the scheme desk allowed, because here the run is not waited on:
 * the measured BigHaat run needed well over a minute to produce its five
 * products, and capping below that would bill for a run that never finishes.
 * At ~5 s per step this is ~18 steps, about $0.29 — above the per-request
 * ceiling, so `TfBudget` refuses it unless the caller raised the ceiling. The
 * route sets $0.35 for exactly this reason.
 */
const AGENT_BUDGET_SEC = 90;

/** Rupee amounts as a page prints them. */
const PRICE_RE = /(?:₹|Rs\.?\s?|INR\s?)\s?(\d[\d,]*(?:\.\d{1,2})?)/;

const cacheKey = (category: InputCategory, term: string) => `v1:${category}:${slug(term)}`;

function parsePrice(text: string): number | null {
  const m = text.match(PRICE_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  // Below ₹5 is almost always a rating, a discount percentage or a stray
  // number; above ₹5 lakh is not a sack of fertiliser.
  return Number.isFinite(n) && n >= 5 && n <= 500_000 ? Math.round(n) : null;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

type CacheRow = {
  rows: InputPriceRow[];
  missing: InputPriceMiss[];
  ladder: TfRungLog[];
  provenance: InputPriceReport["provenance"];
  cost_usd: number;
  checked_at: string;
  expires_at: string;
};

async function readCache(
  category: InputCategory,
  term: string
): Promise<InputPriceReport | null> {
  const admin = hazardAdmin();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("input_price_cache")
      .select("rows, missing, ladder, provenance, cost_usd, checked_at, expires_at")
      .eq("key", cacheKey(category, term))
      .maybeSingle();
    const row = data as CacheRow | null;
    if (!row || !Array.isArray(row.rows) || !row.rows.length) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return {
      category,
      term,
      rows: row.rows,
      missing: Array.isArray(row.missing) ? row.missing : [],
      provenance: "cache",
      ladder: Array.isArray(row.ladder) ? row.ladder : [],
      costUsd: Number(row.cost_usd) || 0,
      checkedAt: row.checked_at,
    };
  } catch {
    // Table not migrated yet — behave as a miss.
    return null;
  }
}

async function writeCache(report: InputPriceReport): Promise<void> {
  const admin = hazardAdmin();
  // "We found nothing" is not cached: the usual cause is a transient upstream
  // failure, and caching it would suppress the next attempt for twelve hours.
  if (!admin || !report.rows.length) return;
  try {
    await admin.from("input_price_cache").upsert(
      {
        key: cacheKey(report.category, report.term),
        category: report.category,
        term: report.term,
        rows: report.rows,
        missing: report.missing,
        ladder: report.ladder,
        provenance: report.provenance,
        cost_usd: report.costUsd,
        checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_SEC * 1000).toISOString(),
      },
      { onConflict: "key", ignoreDuplicates: false }
    );
  } catch {
    /* caching is an optimisation; the caller already has the data */
  }
}

// ─── Rung 1: Search (free) ───────────────────────────────────────────────────

/**
 * Finds a listing URL per site, and takes the price straight from the snippet
 * where there is one. Search snippets on these storefronts frequently carry a
 * rupee amount, which means some lookups answer for nothing at all.
 */
/**
 * Picks the best listing URL for a site from a page of search results.
 *
 * Taking the first host match was wrong, and wrong expensively. For "urea" the
 * first bighaat.com result was the **homepage** — "BigHaat: Agriculture
 * Products Online" — so the Fetch tier read a shop front with no urea on it and
 * the browser run was sent to browse it, finished in five steps, found nothing
 * and still cost $0.08. The tier was working; it had been pointed at the wrong
 * page.
 *
 * Site search URLs would be the obvious fix, but they are not available:
 * bighaat.com/search?q= answers 404 and agribegri.com/search?q= answers
 * bot_blocked. So the selection is made here, deterministically — a homepage is
 * never a listing, and a URL or title that names what the farmer typed is
 * better than one that does not.
 */
function pickListings(hits: TfSearchResultLike[], site: InputSite, term: string): TfSearchResultLike[] {
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const scored = hits
    .filter((h) => hostOf(h.url) === site.host)
    .map((h) => {
      let path = "";
      try {
        path = new URL(h.url).pathname;
      } catch {
        return null;
      }
      // A bare "/" is the shop front, never a listing for a specific product.
      if (path.replace(/\/+$/, "") === "") return null;

      const inPath = words.some((w) => path.toLowerCase().includes(w));
      const inTitle = words.some((w) => h.title.toLowerCase().includes(w));
      return { hit: h, score: (inPath ? 2 : 0) + (inTitle ? 1 : 0) };
    })
    .filter((x): x is { hit: TfSearchResultLike; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  // Several, not one, and Fetch is why: it is free and batched up to ten URLs,
  // so reading three candidates per site costs the same as reading one. It
  // matters because a site is not uniformly readable — agribegri.com serves
  // static product pages (13 198 chars, 240 prices) but builds its *category*
  // pages in the browser (1 777 chars, 0 prices). Asking only for the best
  // match lands on the category page and comes back empty.
  return scored.slice(0, 3).map((x) => x.hit);
}

type TfSearchResultLike = { url: string; title: string; snippet: string };

async function searchRung(
  category: InputCategory,
  term: string,
  sites: InputSite[]
): Promise<{ rows: InputPriceRow[]; urls: Map<string, string[]>; missing: InputPriceMiss[] }> {
  const results = await Promise.all(
    sites.map(async (site) => {
      const hits = await tfSearch(`${term} ${category} price buy online ${site.searchHint}`, {
        location: "IN",
        language: "en",
        domainType: "web",
        label: "tf/input-prices",
      });
      return { site, found: pickListings(hits, site, term) };
    })
  );

  const rows: InputPriceRow[] = [];
  const urls = new Map<string, string[]>();
  const missing: InputPriceMiss[] = [];

  for (const { site, found } of results) {
    if (!found.length) {
      missing.push({ siteId: site.id, siteLabel: site.label, reason: "No listing page found" });
      continue;
    }
    urls.set(site.id, found.map((f) => f.url));

    const hit = found[0];
    const price = parsePrice(`${hit.title} ${hit.snippet}`);
    if (price !== null) {
      rows.push({
        siteId: site.id,
        siteLabel: site.label,
        productName: hit.title.slice(0, 120),
        priceInr: price,
        unit: "",
        url: hit.url,
        tier: "search",
      });
    }
  }

  return { rows, urls, missing };
}

// ─── Rung 2: Fetch (free) ────────────────────────────────────────────────────

/**
 * Reads the sites the probe marked `fetch` and pulls priced lines out of the
 * markdown.
 *
 * Deliberately regex, not a model. The page is a list of products and prices;
 * matching them is a parsing job, and handing it to an LLM would reintroduce
 * exactly the risk the verbatim rule exists to remove.
 */
async function fetchRung(
  term: string,
  sites: InputSite[],
  urls: Map<string, string[]>
): Promise<{ rows: InputPriceRow[]; missing: InputPriceMiss[]; detail: string }> {
  const targets = sites
    .filter((s) => s.access === "fetch")
    .flatMap((s) => (urls.get(s.id) ?? []).map((url) => ({ site: s, url })));

  if (!targets.length) return { rows: [], missing: [], detail: "no fetchable sites" };

  const { pages, errors } = await tfFetch(
    targets.map((t) => t.url),
    { ttl: 3600, timeoutMs: 40_000, label: "tf/input-prices" }
  );

  const rows: InputPriceRow[] = [];
  const missing: InputPriceMiss[] = [];
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  // Grouped by site, because several candidate pages are read per site and the
  // farmer cares which SELLER had the price, not which URL did.
  const bySite = new Map<string, { site: InputSite; found: InputPriceRow[]; errors: string[] }>();
  for (const { site } of targets) {
    if (!bySite.has(site.id)) bySite.set(site.id, { site, found: [], errors: [] });
  }

  for (const { site, url } of targets) {
    const bucket = bySite.get(site.id)!;
    const page = pages.find((p) => p.url === url);
    if (!page) {
      const err = errors.find((e) => e.url === url);
      if (err) bucket.errors.push(err.error);
      continue;
    }

    // A product is a named line near a priced line, not a single line carrying
    // both.
    //
    // Measured on agribegri.com: the page holds 240 rupee amounts, but
    // requiring the term and the price on one line found zero — these
    // storefronts render the product name, then the pack size, then the price
    // as separate markdown lines. So the price anchors the match and the name
    // is taken from the nearest preceding line that mentions the term.
    const lines = page.text.split("\n").map((l) => l.trim());
    const found: InputPriceRow[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < lines.length && found.length < 5; i++) {
      const price = parsePrice(lines[i]);
      if (price === null) continue;

      // Look back a few lines for the product name. Four is enough for
      // name / pack size / rating / price, and short enough that a price never
      // attaches itself to the previous product's name.
      let name = "";
      for (let j = i; j >= Math.max(0, i - 4); j--) {
        const candidate = lines[j].replace(PRICE_RE, "").replace(/[|*#>\[\]]/g, " ").replace(/\s+/g, " ").trim();
        if (candidate.length < 6) continue;
        // Spec-table rows read like product names and are not. agribegri.com
        // renders "Brand::Iris Hybrid Seeds Pvt. Ltd." right above the price,
        // which matches "seeds" and was being shown to the farmer as the thing
        // they were buying.
        if (/^(brand|category|type|weight|packing|sku|mrp|model|technical\s+name)\s*:/i.test(candidate)) continue;
        if (candidate.includes("::")) continue;
        if (!words.some((w) => candidate.toLowerCase().includes(w))) continue;
        name = candidate;
        break;
      }
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      found.push({
        siteId: site.id,
        siteLabel: site.label,
        productName: name.slice(0, 120),
        priceInr: price,
        unit: (name.match(/\b\d+(?:\.\d+)?\s?(?:kg|g|gm|ml|l|ltr|litre|seeds?|packet)\b/i) ?? [""])[0],
        url,
        tier: "fetch" as const,
      });
    }

    bucket.found.push(...found);
  }

  for (const { site, found, errors: siteErrors } of bySite.values()) {
    if (found.length) {
      // Cheapest five per seller: more than that is a catalogue, not a
      // comparison.
      rows.push(...found.sort((a, b) => a.priceInr - b.priceInr).slice(0, 5));
      continue;
    }
    missing.push({
      siteId: site.id,
      siteLabel: site.label,
      reason: siteErrors.length
        ? `Fetch returned ${Array.from(new Set(siteErrors)).join(", ")}`
        : `Pages read, but no priced "${term}" line found`,
    });
  }

  const detail = `${pages.length}/${targets.length} read, ${rows.length} quotes${
    errors.length ? `, ${errors.map((e) => `${hostOf(e.url)} ${e.error}`).join(", ")}` : ""
  }`;
  return { rows, missing, detail };
}

// ─── Rung 3: Agent (paid, async) ─────────────────────────────────────────────

const AGENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price_inr: { type: "number" },
          pack_size: { type: "string" },
          product_url: { type: "string" },
        },
        required: ["name", "price_inr"],
      },
    },
  },
  required: ["products"],
} as const;

function validateProducts(result: unknown, site: InputSite, fallbackUrl: string): InputPriceRow[] | null {
  const list = (result as { products?: unknown })?.products;
  if (!Array.isArray(list)) return null;

  return list
    .map((r): InputPriceRow | null => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim().slice(0, 120) : "";
      const price = Number(row.price_inr);
      if (!name || !Number.isFinite(price) || price < 5 || price > 500_000) return null;

      // A product url is kept only if it is on the site we actually browsed.
      const raw = typeof row.product_url === "string" ? row.product_url : "";
      const url = raw && hostOf(raw) === site.host ? raw : fallbackUrl;

      return {
        siteId: site.id,
        siteLabel: site.label,
        productName: name,
        priceInr: Math.round(price),
        unit: typeof row.pack_size === "string" ? row.pack_size.trim().slice(0, 40) : "",
        url,
        tier: "agent" as const,
      };
    })
    .filter((r): r is InputPriceRow => r !== null);
}

function buildGoal(category: InputCategory, term: string): string {
  return [
    `This page lists ${category} products for sale. Wait for the product cards to load.`,
    `Find the products matching "${term}".`,
    `For each, return its name, its current selling price in rupees as a number, its pack size as printed, and the URL of its product page.`,
    `Return at most 5 products. If none are visible, return an empty products array.`,
  ].join(" ");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type StartResult = InputPriceReport;

/**
 * Cache, then the two free rungs, then — only if those fall short — the start
 * of a browser run. Returns as soon as there is something to say.
 */
export async function startInputPrices(
  q: { category: InputCategory; term: string },
  opts: { allowAgent: boolean; budget: TfBudget; ownerId: string }
): Promise<StartResult> {
  const { category, term } = q;
  const ladder: TfRungLog[] = [];
  const now = () => new Date().toISOString();

  const cached = await readCache(category, term);
  if (cached) {
    ladder.push({ tier: "cache", label: "cached comparison", ms: 0, outcome: "hit" });
    console.info(`tf/input-prices: cache hit (${cached.rows.length} quotes)`);
    return { ...cached, ladder };
  }
  ladder.push({ tier: "cache", label: "cached comparison", ms: 0, outcome: "miss" });

  const live = INPUT_SITES.filter((s) => s.access !== "blocked");
  const blocked: InputPriceMiss[] = INPUT_SITES.filter((s) => s.access === "blocked").map((s) => ({
    siteId: s.id,
    siteLabel: s.label,
    reason: `Not reachable when last probed (${s.probedOn})`,
  }));

  // ── Rung 1 ──
  let t0 = Date.now();
  const search = await searchRung(category, term, live);
  ladder.push({
    tier: "search",
    label: "find listings",
    ms: Date.now() - t0,
    outcome: search.rows.length ? "hit" : "miss",
    detail: `${search.urls.size}/${live.length} sites located, ${search.rows.length} priced snippets`,
  });

  let rows = [...search.rows];
  let missing = [...blocked, ...search.missing];

  if (rows.length >= SUFFICIENT_ROWS) {
    const report: InputPriceReport = {
      category, term, rows, missing,
      provenance: "search", ladder, costUsd: 0, checkedAt: now(),
    };
    await writeCache(report);
    console.info(`tf/input-prices: search answered it, ${rows.length} quotes, $0`);
    return report;
  }

  // ── Rung 2 ──
  t0 = Date.now();
  const fetched = await fetchRung(term, live, search.urls);
  ladder.push({
    tier: "fetch",
    label: "read listing pages",
    ms: Date.now() - t0,
    outcome: fetched.rows.length ? "hit" : "miss",
    detail: fetched.detail,
  });
  rows = [...rows, ...fetched.rows];
  missing = [...missing, ...fetched.missing];

  if (rows.length >= SUFFICIENT_ROWS) {
    const report: InputPriceReport = {
      category, term, rows, missing,
      provenance: rows.some((r) => r.tier === "search") ? "mixed" : "fetch",
      ladder, costUsd: 0, checkedAt: now(),
    };
    await writeCache(report);
    console.info(`tf/input-prices: free tiers answered it, ${rows.length} quotes, $0`);
    return report;
  }

  // ── Rung 3 ──
  // One run, one site: the first the probe marked `agent` and that Search found
  // a page for. More than one would multiply the bill for a comparison that
  // only needs a second quote.
  const target = live.find((s) => s.access === "agent" && search.urls.has(s.id));

  if (!opts.allowAgent || !target) {
    ladder.push({
      tier: "agent",
      label: "browse storefront",
      ms: 0,
      outcome: "skipped",
      detail: !target ? "no agent-marked site had a listing page" : "not requested",
    });
    const report: InputPriceReport = {
      category, term, rows, missing,
      provenance: rows.length ? "mixed" : "fetch",
      ladder, costUsd: 0, checkedAt: now(),
    };
    await writeCache(report);
    return report;
  }

  t0 = Date.now();
  const started = await tfAgentStart({
    url: search.urls.get(target.id)![0],
    goal: buildGoal(category, term),
    outputSchema: AGENT_OUTPUT_SCHEMA,
    browserProfile: "stealth",
    maxDurationSeconds: AGENT_BUDGET_SEC,
    budget: opts.budget,
    label: "tf/input-prices-agent",
  });

  if (!started.ok) {
    ladder.push({
      tier: "agent",
      label: "browse storefront",
      ms: Date.now() - t0,
      outcome: "miss",
      detail: `${started.reason}${started.detail ? `: ${started.detail}` : ""}`,
    });
    missing.push({
      siteId: target.id,
      siteLabel: target.label,
      reason: "Needs a browser, and the browser run could not be started",
    });
    const report: InputPriceReport = {
      category, term, rows, missing,
      provenance: rows.length ? "mixed" : "fetch",
      ladder, costUsd: 0, checkedAt: now(),
    };
    await writeCache(report);
    return report;
  }

  ladder.push({
    tier: "agent",
    label: "browse storefront",
    ms: Date.now() - t0,
    outcome: "hit",
    detail: `${target.label} run started (free tiers gave ${rows.length}/${SUFFICIENT_ROWS})`,
  });

  await recordRun(started.runId, opts.ownerId, {
    category, term, siteId: target.id, keyIndex: started.keyIndex, rows, missing, ladder,
  });
  console.info(
    `tf/input-prices: free tiers gave ${rows.length}, started ${target.label} browser run ${started.runId}`
  );

  return {
    category, term, rows, missing,
    provenance: rows.length ? "mixed" : "fetch",
    ladder, costUsd: 0, checkedAt: now(),
    pendingRunId: started.runId,
    pendingSite: target.label,
  };
}

async function recordRun(
  runId: string,
  ownerId: string,
  ctx: {
    category: InputCategory;
    term: string;
    siteId: string;
    keyIndex: number;
    rows: InputPriceRow[];
    missing: InputPriceMiss[];
    ladder: TfRungLog[];
  }
): Promise<void> {
  const admin = hazardAdmin();
  if (!admin) return;
  try {
    await admin.from("input_price_runs").insert({
      run_id: runId,
      owner_id: ownerId,
      cache_key: cacheKey(ctx.category, ctx.term),
      category: ctx.category,
      term: ctx.term,
      site_id: ctx.siteId,
      key_index: ctx.keyIndex,
      partial: ctx.rows,
      missing: ctx.missing,
      ladder: ctx.ladder,
    });
  } catch {
    /* the run still works; only the ownership check and merge are lost */
  }
}

type PendingRun = {
  cache_key: string;
  category: InputCategory;
  term: string;
  site_id: string;
  key_index: number;
  partial: InputPriceRow[];
  missing: InputPriceMiss[];
  ladder: TfRungLog[];
};

export type CollectResult =
  | { state: "running" }
  | { state: "unknown" }
  | { state: "done"; report: InputPriceReport };

/**
 * One poll of a run started by `startInputPrices`.
 *
 * The ownership check is the point of `input_price_runs`: a run id is a bearer
 * token for work someone else paid for, so a poll only answers to the account
 * that started it.
 */
export async function collectInputPrices(
  runId: string,
  opts: { budget: TfBudget; ownerId: string }
): Promise<CollectResult> {
  const admin = hazardAdmin();
  if (!admin) return { state: "unknown" };

  let run: PendingRun | null = null;

  try {
    const { data } = await admin
      .from("input_price_runs")
      .select("cache_key, category, term, site_id, key_index, partial, missing, ladder")
      .eq("run_id", runId)
      .eq("owner_id", opts.ownerId)
      .maybeSingle();
    run = data as PendingRun | null;
  } catch {
    return { state: "unknown" };
  }
  if (!run) return { state: "unknown" };

  const site = siteById(run.site_id);
  if (!site) return { state: "unknown" };

  const poll = await tfAgentPoll<InputPriceRow[]>(runId, {
    budget: opts.budget,
    label: "tf/input-prices-agent",
    // The key that started the run is the only one that can collect it.
    keyIndex: Number(run.key_index) || 0,
    validate: (result) => validateProducts(result, site, run!.partial[0]?.url ?? ""),
  });

  if (poll.state === "running") return { state: "running" };

  const ladder: TfRungLog[] = [...(Array.isArray(run.ladder) ? run.ladder : [])];
  const rows = [...(Array.isArray(run.partial) ? run.partial : [])];
  const missing = [...(Array.isArray(run.missing) ? run.missing : [])];

  if (poll.state === "failed") {
    ladder.push({
      tier: "agent",
      label: "browse storefront",
      ms: 0,
      outcome: "miss",
      detail: `${poll.reason}${poll.detail ? `: ${poll.detail}` : ""}`,
      costUsd: poll.costUsd,
    });
    missing.push({
      siteId: site.id,
      siteLabel: site.label,
      reason: "The browser run did not return products",
    });
  } else {
    ladder.push({
      tier: "agent",
      label: "browse storefront",
      ms: 0,
      outcome: poll.data.length ? "hit" : "miss",
      detail: `${poll.steps} steps, ${poll.data.length} products`,
      costUsd: poll.costUsd,
    });
    if (poll.data.length) rows.push(...poll.data);
    else
      missing.push({
        siteId: site.id,
        siteLabel: site.label,
        reason: "The browser reached the page but found no matching products",
      });
  }

  const report: InputPriceReport = {
    category: run.category,
    term: run.term,
    rows,
    missing,
    provenance: rows.some((r) => r.tier === "agent")
      ? rows.every((r) => r.tier === "agent")
        ? "agent"
        : "mixed"
      : "mixed",
    ladder,
    costUsd: poll.costUsd,
    checkedAt: new Date().toISOString(),
  };

  await writeCache(report);
  try {
    await admin.from("input_price_runs").delete().eq("run_id", runId);
  } catch {
    /* the row expires with the account; leaving it is harmless */
  }

  console.info(
    `tf/input-prices: run ${runId} ${poll.state}, ${report.rows.length} quotes, $${report.costUsd.toFixed(3)}`
  );
  return { state: "done", report };
}
