import "server-only";
import { fetchWithRetry } from "@/lib/http";
import {
  chargeKey,
  keyByIndex,
  loadKeys,
  nextKeyAfter,
  pickKey,
  type TfKey,
} from "@/lib/tfKeys";

/**
 * TinyFish — the app's hands on the parts of the agri web that have no API.
 *
 * ── Why a ladder, and not just "call the agent" ───────────────────────────────
 *
 * TinyFish exposes four products at very different prices. Search and Fetch are
 * free; the Web Agent bills $0.016 per step and a step is roughly five seconds
 * of a real browser. The difference is not academic — a measured 166-second run
 * in `src/app/api/live-mandi/route.ts` took 33 steps and cost $0.53. Reaching
 * for the agent first would be both slower and about fifty times dearer than
 * necessary for pages that are plain HTML.
 *
 * But the cheap tiers genuinely cannot read some sites, and this was measured
 * rather than assumed (2026-10-20, via the free Fetch API):
 *
 *   mausam.imd.gov.in            → clean markdown, several KB       · Fetch is enough
 *   myscheme.gov.in/search/...   → page chrome and footer ONLY      · SPA, agent required
 *   agmarknet.gov.in             → target_http_error 403            · blocked outright
 *   bighaat.com/collections/...  → renders, but "No products found" · client-rendered
 *
 * That last one is the clearest case. Fetch reads the page and finds no
 * products because the listing is assembled in the browser; the Web Agent, run
 * against the identical URL, returned five real products with prices and
 * working links (run 56796963-b2e8-43b5-977b-8878d97f927f: "Eureka SUPER NAPIER
 * GRASS Forage Seeds" ₹670/500 g, "Gentex Bhima Shakti Onion Seeds" ₹2,729/1 kg,
 * and three more). Same URL, same moment, one tier blind and the other not.
 *
 * So: Search (free) → Fetch (free) → Agent (paid), and the paid rung runs only
 * when the cheap rungs have *provably* failed on this exact URL in this exact
 * request. `runLadder` makes that escalation a first-class, logged object
 * rather than an if/else nobody can audit, because "we spent money here, and
 * here is the measurement that justified it" is the only honest way to bill a
 * farmer's request to a browser.
 *
 * ── Nothing here throws ───────────────────────────────────────────────────────
 *
 * Every caller already has a degradation path — the schemes board falls back to
 * the built-in catalogue, the news feed falls back to empty. A thrown error
 * would convert those graceful fallbacks into a 500. So each wrapper returns a
 * value meaning "nothing", and the ladder log says why.
 */

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const AGENT_RUN_URL = "https://agent.tinyfish.ai/v1/automation/run";

/** Measured 1–3 s. Ten is generous enough to absorb a slow cold start. */
const SEARCH_TIMEOUT_MS = 10_000;

/**
 * The backend allows 110 s per URL with a 120 s CDN ceiling on the batch, so a
 * client timeout under ~130 s aborts requests that would have succeeded. The
 * callers that cannot afford to wait that long pass a shorter one explicitly.
 */
const FETCH_TIMEOUT_MS = 150_000;

/** The API's hard cap on a single Fetch batch. */
const FETCH_MAX_URLS = 10;

export const AGENT_USD_PER_STEP = 0.016;

/**
 * Seconds of wall clock per agent step, used to price a run *before* starting
 * it. From the two runs recorded in live-mandi/route.ts: 89 s / 17 steps = 5.2,
 * and 166 s / 33 steps = 5.0. The API exposes no `max_steps`, so the duration
 * cap is the only lever on cost, and this is what converts one into the other.
 */
const AGENT_SECONDS_PER_STEP = 5;

/**
 * Whether a response means "nothing was started, and nothing was billed".
 *
 * This is the one case where retrying an agent call is safe. `retries: 0` is
 * otherwise load-bearing on every billable endpoint, because /run cannot be
 * cancelled and a retry starts a SECOND browser run. But a 402
 * INSUFFICIENT_CREDITS or a 401 INVALID_API_KEY is rejected before any browser
 * is allocated: nothing is executing and nothing is on the invoice. Retrying
 * once, on a different key from the pool, cannot double-bill.
 *
 * Every other status keeps the original rule.
 */
function isNoRunStarted(status: number): boolean {
  return status === 402 || status === 401;
}

/**
 * The on-stage panic button.
 *
 * Set TINYFISH_AGENT_ENABLED=0 and every paid rung reports `disabled` while
 * Search and Fetch keep working — the app degrades to its free tiers instead of
 * breaking. Same reasoning as GROQ_TEXT_MODEL in http.ts: when the failure is
 * about money or a dead upstream, recovery should be one environment variable
 * and not a redeploy.
 */
function agentEnabled(): boolean {
  return process.env.TINYFISH_AGENT_ENABLED !== "0" && loadKeys().length > 0;
}

// ─── Tier 1: Search (free) ───────────────────────────────────────────────────

export type TfSearchResult = {
  position: number;
  title: string;
  url: string;
  snippet: string;
  site_name: string;
  date?: string;
};

/**
 * The API rejects `recency_minutes` combined with either date filter. Expressed
 * as a union so that combination is a compile error rather than a 400 nobody
 * sees until it is live.
 */
export type TfSearchWindow =
  | { recencyMinutes: number; afterDate?: never; beforeDate?: never }
  | { recencyMinutes?: never; afterDate?: string; beforeDate?: string };

export type TfSearchOpts = TfSearchWindow & {
  /** ISO country code, e.g. "IN". */
  location?: string;
  language?: string;
  domainType?: "web" | "news" | "research_paper";
  /** Log prefix, so a failing query is identifiable. */
  label: string;
};

/** Returns [] on a missing key, a timeout, a non-2xx, or a malformed body. */
export async function tfSearch(query: string, opts: TfSearchOpts): Promise<TfSearchResult[]> {
  let key = await pickKey();
  if (!key || !query.trim()) return [];

  // Search is free and idempotent, so retrying on another key when this one
  // reports no credits is strictly safer than the agent's equivalent — there is
  // not even a bill to double. Without it, one exhausted key at the front of
  // the pool blanks the news feed for a whole request before the ledger
  // learns to route around it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await searchOnce(query, opts, key);
    if (!out.retryOtherKey) return out.results;
    const next = await nextKeyAfter(key);
    if (!next) return out.results;
    key = next;
  }
  return [];
}

async function searchOnce(
  query: string,
  opts: TfSearchOpts,
  key: TfKey
): Promise<{ results: TfSearchResult[]; retryOtherKey: boolean }> {
  const params = new URLSearchParams({ query });
  if (opts.location) params.set("location", opts.location);
  if (opts.language) params.set("language", opts.language);
  if (opts.domainType) params.set("domain_type", opts.domainType);
  if (opts.recencyMinutes != null) params.set("recency_minutes", String(opts.recencyMinutes));
  if (opts.afterDate) params.set("after_date", opts.afterDate);
  if (opts.beforeDate) params.set("before_date", opts.beforeDate);

  try {
    // Free and idempotent, so the default retry applies — and http.ts documents
    // the local TLS flakiness that makes a retry worth having.
    const res = await fetchWithRetry(
      `${SEARCH_URL}?${params.toString()}`,
      { headers: { "X-API-Key": key.secret }, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
      { label: opts.label }
    );
    // Counted whatever the outcome: a rejected query may still have been
    // metered upstream, and under-counting the pool is the dangerous direction.
    await chargeKey(key, { searches: 1 });
    if (!res.ok) {
      console.warn(`${opts.label}: search HTTP ${res.status} on ${key.label}`);
      return { results: [], retryOtherKey: isNoRunStarted(res.status) };
    }
    const body = (await res.json()) as { results?: unknown };
    if (!Array.isArray(body?.results)) return { results: [], retryOtherKey: false };

    const results = body.results
      .map((r, i): TfSearchResult | null => {
        if (!r || typeof r !== "object") return null;
        const row = r as Record<string, unknown>;
        const url = typeof row.url === "string" ? row.url : "";
        const title = typeof row.title === "string" ? row.title : "";
        if (!url || !title) return null;
        return {
          position: Number(row.position) || i + 1,
          title,
          url,
          snippet: typeof row.snippet === "string" ? row.snippet : "",
          site_name: typeof row.site_name === "string" ? row.site_name : hostOf(url),
          date: typeof row.date === "string" ? row.date : undefined,
        };
      })
      .filter((r): r is TfSearchResult => r !== null);
    return { results, retryOtherKey: false };
  } catch (e) {
    console.warn(`${opts.label}: search ${(e as Error)?.message || "failed"}`);
    return { results: [], retryOtherKey: false };
  }
}

// ─── Tier 2: Fetch (free) ────────────────────────────────────────────────────

export type TfFetchErrorCode =
  | "target_http_error"
  | "page_not_found"
  | "timeout"
  | "bot_blocked"
  | "empty_content"
  | "login_required"
  | "content_too_large"
  | "invalid_url"
  | "target_unreachable"
  /** Observed against ahvs.karnataka.gov.in — upstream refused the proxy hop. */
  | "proxy_error"
  /** Not from the API: ours, for URLs past the batch cap. */
  | "not_attempted";

export type TfFetchPage = {
  url: string;
  final_url: string;
  title: string;
  description: string;
  language: string;
  /** The page as markdown. */
  text: string;
  author: string | null;
  published_date: string | null;
  latency_ms: number;
};

export type TfFetchError = { url: string; error: TfFetchErrorCode; status?: number };

export type TfFetchOpts = {
  /** Omit for default caching, 0 for a live read, or max age in seconds. */
  ttl?: number;
  timeoutMs?: number;
  label: string;
};

/**
 * Reads up to ten URLs. A URL that fails does not fail the batch — it comes
 * back in `errors`, which callers are expected to surface rather than swallow:
 * "this site blocked us" is information a farmer can act on, and silence is not.
 */
export async function tfFetch(
  urls: string[],
  opts: TfFetchOpts
): Promise<{ pages: TfFetchPage[]; errors: TfFetchError[] }> {
  let key = await pickKey();
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!key || !unique.length) return { pages: [], errors: [] };

  // Free and idempotent, so the same safe retry as Search. See tfSearch.
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await fetchOnce(unique, opts, key);
    if (!out.retryOtherKey) return out.result;
    const next = await nextKeyAfter(key);
    if (!next) return out.result;
    key = next;
  }
  return { pages: [], errors: [] };
}

async function fetchOnce(
  unique: string[],
  opts: TfFetchOpts,
  key: TfKey
): Promise<{ result: { pages: TfFetchPage[]; errors: TfFetchError[] }; retryOtherKey: boolean }> {
  // Over the cap, the extras are reported rather than silently dropped.
  const attempted = unique.slice(0, FETCH_MAX_URLS);
  const overflow: TfFetchError[] = unique
    .slice(FETCH_MAX_URLS)
    .map((url) => ({ url, error: "not_attempted" as const }));

  const body: Record<string, unknown> = { urls: attempted };
  if (opts.ttl != null) body.ttl = opts.ttl;

  try {
    const res = await fetchWithRetry(
      FETCH_URL,
      {
        method: "POST",
        headers: { "X-API-Key": key.secret, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS),
      },
      { label: opts.label }
    );
    await chargeKey(key, { fetchUrls: attempted.length });
    if (!res.ok) {
      console.warn(`${opts.label}: fetch HTTP ${res.status} on ${key.label}`);
      return {
        result: { pages: [], errors: overflow },
        retryOtherKey: isNoRunStarted(res.status),
      };
    }

    const data = (await res.json()) as { results?: unknown; errors?: unknown };
    const pages = (Array.isArray(data?.results) ? data.results : [])
      .map((r): TfFetchPage | null => {
        if (!r || typeof r !== "object") return null;
        const row = r as Record<string, unknown>;
        const url = typeof row.url === "string" ? row.url : "";
        if (!url) return null;
        return {
          url,
          final_url: typeof row.final_url === "string" ? row.final_url : url,
          title: typeof row.title === "string" ? row.title : "",
          description: typeof row.description === "string" ? row.description : "",
          language: typeof row.language === "string" ? row.language : "",
          text: typeof row.text === "string" ? row.text : "",
          author: typeof row.author === "string" ? row.author : null,
          published_date: typeof row.published_date === "string" ? row.published_date : null,
          latency_ms: Number(row.latency_ms) || 0,
        };
      })
      .filter((p): p is TfFetchPage => p !== null);

    const errors = (Array.isArray(data?.errors) ? data.errors : [])
      .map((e): TfFetchError | null => {
        if (!e || typeof e !== "object") return null;
        const row = e as Record<string, unknown>;
        const url = typeof row.url === "string" ? row.url : "";
        if (!url) return null;
        return {
          url,
          error: (typeof row.error === "string" ? row.error : "timeout") as TfFetchErrorCode,
          status: Number.isFinite(Number(row.status)) ? Number(row.status) : undefined,
        };
      })
      .filter((e): e is TfFetchError => e !== null);

    return { result: { pages, errors: [...errors, ...overflow] }, retryOtherKey: false };
  } catch (e) {
    console.warn(`${opts.label}: fetch ${(e as Error)?.message || "failed"}`);
    return { result: { pages: [], errors: overflow }, retryOtherKey: false };
  }
}

// ─── Tier 3: Agent (paid) ────────────────────────────────────────────────────

/**
 * A spend ceiling for one request.
 *
 * `canAfford` is checked BEFORE a run starts, because there is no refund for
 * discovering the price afterwards. `charge` records what was actually spent so
 * a second agent rung in the same request sees the real balance, not the
 * estimate.
 */
export type TfBudget = {
  readonly maxUsd: number;
  spentUsd: number;
  canAfford(estimateUsd: number): boolean;
  charge(steps: number): number;
};

export function newBudget(maxUsd: number): TfBudget {
  return {
    maxUsd,
    spentUsd: 0,
    canAfford(estimateUsd: number) {
      return this.spentUsd + estimateUsd <= this.maxUsd;
    },
    charge(steps: number) {
      const cost = Math.max(0, steps) * AGENT_USD_PER_STEP;
      this.spentUsd += cost;
      return cost;
    },
  };
}

export type TfAgentFailure =
  /** No key, or the TINYFISH_AGENT_ENABLED kill switch is off. */
  | "disabled"
  /** Refused pre-flight by the budget. The run was never started. */
  | "budget"
  /** 4xx/5xx. 402 INSUFFICIENT_CREDITS and 401 INVALID_API_KEY land here. */
  | "http"
  | "timeout"
  /** A COMPLETED run whose own result says the goal failed. */
  | "goal_failure"
  /** COMPLETED, no failure marker, but the result did not validate. */
  | "bad_shape";

export type TfAgentOutcome<T> =
  | { ok: true; data: T; runId?: string; steps: number; costUsd: number }
  | { ok: false; reason: TfAgentFailure; detail?: string; steps: number; costUsd: number };

export type TfAgentRequest<T> = {
  url: string;
  goal: string;
  /** Must avoid `additionalProperties`, `oneOf` and `const` — all 400 before the run starts. */
  outputSchema: object;
  /** The API's own enum is lite | stealth; lite is cheaper and enough for a static table. */
  browserProfile?: "lite" | "default" | "stealth";
  maxDurationSeconds: number;
  budget: TfBudget;
  /** Narrows the agent's free-form result. Returning null means "bad_shape". */
  validate: (result: unknown) => T | null;
  label: string;
};

/** What a run can cost at worst, given only the duration cap to bound it. */
export function estimateAgentUsd(maxDurationSeconds: number): number {
  return Math.ceil(maxDurationSeconds / AGENT_SECONDS_PER_STEP) * AGENT_USD_PER_STEP;
}

export async function tfAgent<T>(req: TfAgentRequest<T>): Promise<TfAgentOutcome<T>> {
  if (!agentEnabled()) {
    return { ok: false, reason: "disabled", steps: 0, costUsd: 0 };
  }

  const estimate = estimateAgentUsd(req.maxDurationSeconds);
  if (!req.budget.canAfford(estimate)) {
    const left = req.budget.maxUsd - req.budget.spentUsd;
    return {
      ok: false,
      reason: "budget",
      detail: `needs ~$${estimate.toFixed(3)}, $${left.toFixed(3)} left`,
      steps: 0,
      costUsd: 0,
    };
  }

  let key = await pickKey();
  if (!key) return { ok: false, reason: "disabled", steps: 0, costUsd: 0 };

  // At most two attempts, and only ever for the no-run-started statuses. See
  // isNoRunStarted: anything else and a second call would be a second bill.
  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await runAgentOnce(req, key);
    if (outcome.retryOtherKey) {
      const next = await nextKeyAfter(key);
      if (next) {
        key = next;
        continue;
      }
    }
    return outcome.result;
  }
  return { ok: false, reason: "http", detail: "no usable key", steps: 0, costUsd: 0 };
}

/** One agent call on one key. `retryOtherKey` means nothing was started or billed. */
async function runAgentOnce<T>(
  req: TfAgentRequest<T>,
  key: TfKey
): Promise<{ result: TfAgentOutcome<T>; retryOtherKey: boolean }> {
  try {
    const res = await fetchWithRetry(
      AGENT_RUN_URL,
      {
        method: "POST",
        headers: { "X-API-Key": key.secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: req.url,
          goal: req.goal,
          output_schema: req.outputSchema,
          browser_profile: req.browserProfile ?? "stealth",
          // Ends the run on TinyFish's side rather than having us abandon it
          // mid-flight — an abandoned run is still a billed run.
          agent_config: { max_duration_seconds: req.maxDurationSeconds },
        }),
        signal: AbortSignal.timeout((req.maxDurationSeconds + 10) * 1000),
      },
      // `retries: 0` is load-bearing. /run cannot be cancelled, so a retry
      // starts a SECOND billable browser run and blows the time budget twice
      // over. live-mandi/route.ts learned this first.
      { retries: 0, label: req.label }
    );

    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json()).slice(0, 300);
      } catch {
        /* body not JSON, or already consumed */
      }
      return {
        result: {
          ok: false,
          reason: "http",
          detail: `HTTP ${res.status} ${detail}`,
          steps: 0,
          costUsd: 0,
        },
        retryOtherKey: isNoRunStarted(res.status),
      };
    }

    const run = (await res.json()) as {
      run_id?: string;
      status?: string;
      num_of_steps?: number;
      result?: unknown;
      error?: { code?: string; message?: string } | null;
    };

    const steps = Number(run.num_of_steps) || 0;
    const costUsd = req.budget.charge(steps);
    await chargeKey(key, { steps });

    // Three gates, because each fails differently and a demo needs to know
    // which one tripped. A run can be HTTP 200 and COMPLETED and still have
    // achieved nothing.
    if (run.status !== "COMPLETED") {
      return {
        result: {
          ok: false,
          reason: "http",
          detail: `status=${run.status} ${run.error?.code ?? ""}`.trim(),
          steps,
          costUsd,
        },
        retryOtherKey: false,
      };
    }

    const result = run.result;
    if (result && typeof result === "object") {
      const asObj = result as Record<string, unknown>;
      if (typeof asObj.status === "string" && asObj.status.toLowerCase() === "failure") {
        const reason = typeof asObj.reason === "string" ? asObj.reason.slice(0, 200) : "";
        return {
          result: { ok: false, reason: "goal_failure", detail: reason, steps, costUsd },
          retryOtherKey: false,
        };
      }
    }

    const data = req.validate(result);
    if (data === null) {
      return { result: { ok: false, reason: "bad_shape", steps, costUsd }, retryOtherKey: false };
    }

    return {
      result: { ok: true, data, runId: run.run_id, steps, costUsd },
      retryOtherKey: false,
    };
  } catch (e) {
    const err = e as Error;
    const timedOut = err?.name === "AbortError" || err?.name === "TimeoutError";
    return {
      result: {
        ok: false,
        reason: timedOut ? "timeout" : "http",
        detail: err?.message?.slice(0, 200),
        steps: 0,
        costUsd: 0,
      },
      // A thrown error is NOT proof that no run started — the request may have
      // reached TinyFish and the response been lost. Never retry on it.
      retryOtherKey: false,
    };
  }
}

// ─── Tier 3, async: start a run now, collect it later ────────────────────────

/**
 * Why the agent has a second, async shape.
 *
 * Measured runs take 70–166 seconds. A Next.js route on Vercel's Hobby plan is
 * killed at 60. So the synchronous `tfAgent` above can only ever be used where
 * the run is expected to finish well inside a minute — and for a storefront
 * listing, it is not. Waiting on it inside the request would mean the platform
 * kills the function while TinyFish keeps running and billing, and the farmer
 * sees a 504 for work they still paid for.
 *
 * `run-async` returns a run id immediately. The route hands that id to the
 * client, the client polls, and the run outlives the request that started it.
 */

const AGENT_ASYNC_URL = "https://agent.tinyfish.ai/v1/automation/run-async";
const AGENT_RUNS_URL = "https://agent.tinyfish.ai/v1/runs";

export type TfAgentStart =
  /**
   * `keyIndex` must be persisted with the run. TinyFish resolves a run id only
   * for the account that created it, so collecting this run later with a
   * sibling key from the pool would 404 work that has already been paid for.
   */
  | { ok: true; runId: string; estimateUsd: number; keyIndex: number }
  | { ok: false; reason: TfAgentFailure; detail?: string };

export async function tfAgentStart(req: {
  url: string;
  goal: string;
  outputSchema: object;
  /** The API's own enum is lite | stealth; lite is cheaper and enough for a static table. */
  browserProfile?: "lite" | "default" | "stealth";
  maxDurationSeconds: number;
  budget: TfBudget;
  label: string;
}): Promise<TfAgentStart> {
  if (!agentEnabled()) return { ok: false, reason: "disabled" };

  const estimate = estimateAgentUsd(req.maxDurationSeconds);
  if (!req.budget.canAfford(estimate)) {
    return { ok: false, reason: "budget", detail: `needs ~$${estimate.toFixed(3)}` };
  }

  let key = await pickKey();
  if (!key) return { ok: false, reason: "disabled" };

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await startAgentOnce(req, key);
    if (out.retryOtherKey) {
      const next = await nextKeyAfter(key);
      if (next) {
        key = next;
        continue;
      }
    }
    return out.result;
  }
  return { ok: false, reason: "http", detail: "no usable key" };
}

async function startAgentOnce(
  req: {
    url: string;
    goal: string;
    outputSchema: object;
    /** The API's own enum is lite | stealth; lite is cheaper and enough for a static table. */
  browserProfile?: "lite" | "default" | "stealth";
    maxDurationSeconds: number;
    budget: TfBudget;
    label: string;
  },
  key: TfKey
): Promise<{ result: TfAgentStart; retryOtherKey: boolean }> {
  const estimate = estimateAgentUsd(req.maxDurationSeconds);
  try {
    const res = await fetchWithRetry(
      AGENT_ASYNC_URL,
      {
        method: "POST",
        headers: { "X-API-Key": key.secret, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: req.url,
          goal: req.goal,
          output_schema: req.outputSchema,
          browser_profile: req.browserProfile ?? "stealth",
          agent_config: { max_duration_seconds: req.maxDurationSeconds },
        }),
        signal: AbortSignal.timeout(20_000),
      },
      // run-async has no idempotency key, so a retry would create a second
      // billable run exactly as the synchronous endpoint would.
      { retries: 0, label: req.label }
    );

    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json()).slice(0, 200);
      } catch {
        /* not JSON */
      }
      return {
        result: { ok: false, reason: "http", detail: `HTTP ${res.status} ${detail}` },
        retryOtherKey: isNoRunStarted(res.status),
      };
    }

    const body = (await res.json()) as { run_id?: string };
    if (!body.run_id) {
      return {
        result: { ok: false, reason: "bad_shape", detail: "no run_id" },
        retryOtherKey: false,
      };
    }
    return {
      result: { ok: true, runId: body.run_id, estimateUsd: estimate, keyIndex: key.index },
      retryOtherKey: false,
    };
  } catch (e) {
    return {
      result: { ok: false, reason: "http", detail: (e as Error)?.message?.slice(0, 160) },
      retryOtherKey: false,
    };
  }
}

export type TfAgentPoll<T> =
  | { state: "running"; steps: number }
  | { state: "done"; data: T; steps: number; costUsd: number }
  | { state: "failed"; reason: TfAgentFailure; detail?: string; steps: number; costUsd: number };

/** One poll of a run started by `tfAgentStart`. Never throws. */
export async function tfAgentPoll<T>(
  runId: string,
  opts: {
    budget: TfBudget;
    validate: (result: unknown) => T | null;
    label: string;
    /** The pool position recorded when the run was started. See TfAgentStart. */
    keyIndex: number;
  }
): Promise<TfAgentPoll<T>> {
  const key = keyByIndex(opts.keyIndex);
  if (!key) {
    // The pool shrank or was reordered while a run was in flight. Say so
    // plainly rather than polling with the wrong key and reporting a 404 as
    // though the run had failed.
    console.warn(`${opts.label}: no key at index ${opts.keyIndex} to collect run ${runId}`);
    return { state: "failed", reason: "disabled", steps: 0, costUsd: 0 };
  }

  try {
    const res = await fetchWithRetry(
      `${AGENT_RUNS_URL}/${encodeURIComponent(runId)}`,
      { headers: { "X-API-Key": key.secret }, signal: AbortSignal.timeout(15_000) },
      // A poll is a free, idempotent read, so unlike starting a run it is safe
      // to retry.
      { label: opts.label }
    );
    if (!res.ok) {
      return { state: "failed", reason: "http", detail: `HTTP ${res.status}`, steps: 0, costUsd: 0 };
    }

    const run = (await res.json()) as {
      status?: string;
      num_of_steps?: number;
      result?: unknown;
      error?: { code?: string; message?: string } | null;
    };
    const steps = Number(run.num_of_steps) || 0;

    if (run.status === "PENDING" || run.status === "RUNNING") {
      return { state: "running", steps };
    }

    // Charged once, when the run reaches a terminal state — polling itself is
    // free, and charging per poll would invent a cost that does not exist.
    const costUsd = opts.budget.charge(steps);
    await chargeKey(key, { steps });

    if (run.status !== "COMPLETED") {
      return {
        state: "failed",
        reason: "http",
        detail: `status=${run.status} ${run.error?.code ?? ""}`.trim(),
        steps,
        costUsd,
      };
    }

    const result = run.result;
    if (result && typeof result === "object") {
      const asObj = result as Record<string, unknown>;
      if (typeof asObj.status === "string" && asObj.status.toLowerCase() === "failure") {
        const reason = typeof asObj.reason === "string" ? asObj.reason.slice(0, 200) : "";
        return { state: "failed", reason: "goal_failure", detail: reason, steps, costUsd };
      }
    }

    const data = opts.validate(result);
    if (data === null) return { state: "failed", reason: "bad_shape", steps, costUsd };
    return { state: "done", data, steps, costUsd };
  } catch (e) {
    return {
      state: "failed",
      reason: "http",
      detail: (e as Error)?.message?.slice(0, 160),
      steps: 0,
      costUsd: 0,
    };
  }
}

// ─── The ladder ──────────────────────────────────────────────────────────────

export type TfTier = "cache" | "search" | "fetch" | "agent" | "builtin";

export type TfRungLog = {
  tier: TfTier;
  label: string;
  ms: number;
  outcome: "hit" | "miss" | "skipped" | "error";
  /** The measurement: "2/6 urls bot_blocked", "14 steps". */
  detail?: string;
  costUsd?: number;
};

export type TfRungResult<T> = { value: T | null; detail?: string; costUsd?: number };

export type TfRung<T> = {
  tier: TfTier;
  label: string;
  /** Return a null `value` to mean "this rung produced nothing". */
  run: (prev: TfRungLog[]) => Promise<TfRungResult<T>>;
  /**
   * The gate that justifies escalating to this rung. It must be decidable from
   * `prev` — that is what makes a paid rung defensible after the fact.
   */
  shouldRun?: (prev: TfRungLog[]) => boolean;
  /** True when this rung's value is good enough to stop climbing. */
  sufficient: (value: T) => boolean;
};

export type TfLadderOutcome<T> = {
  value: T | null;
  via: TfTier | null;
  log: TfRungLog[];
  costUsd: number;
};

/**
 * Runs rungs in order until one produces a sufficient value.
 *
 * The log is the point as much as the value is. It records what each tier cost,
 * how long it took and why the next one was or was not tried, and callers put
 * it straight into their JSON response — so "why did this request spend money"
 * is answerable from the response itself, not from a server log nobody has.
 */
export async function runLadder<T>(
  rungs: TfRung<T>[],
  opts: { label: string }
): Promise<TfLadderOutcome<T>> {
  const log: TfRungLog[] = [];
  let value: T | null = null;
  let via: TfTier | null = null;
  let costUsd = 0;

  for (const rung of rungs) {
    if (rung.shouldRun && !rung.shouldRun(log)) {
      log.push({ tier: rung.tier, label: rung.label, ms: 0, outcome: "skipped" });
      continue;
    }

    const started = Date.now();
    try {
      const got = await rung.run(log);
      const ms = Date.now() - started;
      costUsd += got.costUsd ?? 0;

      if (got.value !== null && rung.sufficient(got.value)) {
        log.push({
          tier: rung.tier,
          label: rung.label,
          ms,
          outcome: "hit",
          detail: got.detail,
          costUsd: got.costUsd,
        });
        value = got.value;
        via = rung.tier;
        break;
      }

      // A rung can produce something real without producing enough. Partial
      // results are kept, so a later rung's failure still leaves the best
      // answer we found rather than nothing.
      if (got.value !== null) {
        value = got.value;
        via = rung.tier;
      }
      log.push({
        tier: rung.tier,
        label: rung.label,
        ms,
        outcome: got.value === null ? "miss" : "hit",
        detail: got.detail,
        costUsd: got.costUsd,
      });
    } catch (e) {
      // A rung should handle its own failures; this is the backstop that keeps
      // one broken tier from taking the whole ladder down.
      log.push({
        tier: rung.tier,
        label: rung.label,
        ms: Date.now() - started,
        outcome: "error",
        detail: (e as Error)?.message?.slice(0, 160),
      });
    }
  }

  console.info(`${opts.label}: ${formatLadder(log)}`);
  return { value, via, log, costUsd };
}

/** The one-line summary printed per request — the escalation, readable at a glance. */
export function formatLadder(log: TfRungLog[]): string {
  if (!log.length) return "no rungs run";
  return log
    .map((r) => {
      const secs = `${(r.ms / 1000).toFixed(1)}s`;
      const cost = r.costUsd ? ` $${r.costUsd.toFixed(3)}` : "";
      const detail = r.detail ? `(${r.detail})` : "";
      return `${r.tier} ${secs} ${r.outcome}${detail}${cost}`;
    })
    .join(" → ");
}

// ─── Small shared helpers ────────────────────────────────────────────────────

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
