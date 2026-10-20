import "server-only";
import { SCHEMES, type Scheme } from "@/lib/schemes";
import { hazardAdmin } from "@/lib/hazards/store";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import {
  tfSearch,
  tfFetch,
  runLadder,
  hostOf,
  slug,
  type TfBudget,
  type TfFetchPage,
  type TfRung,
  type TfRungLog,
  type TfSearchResult,
} from "@/lib/tinyfish";
import { anyKeyConfigured } from "@/lib/tfKeys";

/**
 * The live scheme desk.
 *
 * ── The gap this closes ──────────────────────────────────────────────────────
 *
 * `src/lib/schemes.ts` is eight hand-written central schemes with deadlines
 * stored as literal strings ("Kharif: 31 Jul · Rabi: 31 Dec"). It is accurate
 * and it is also everything the app knows. A farmer in Karnataka never sees
 * Krishi Bhagya or Savayava Bhagya; a farmer anywhere never sees a scheme
 * announced after the array was last edited.
 *
 * The reason it was hardcoded is that there is no API. India publishes its
 * schemes as *websites* — state agriculture departments, myscheme.gov.in,
 * agrimachinery.nic.in — and the national aggregator is a client-rendered app
 * that returns an empty shell to anything that is not a browser. That is
 * precisely the shape of problem TinyFish exists for.
 *
 * ── What is never allowed to happen ──────────────────────────────────────────
 *
 * A farmer can lose a season by applying to a scheme that does not exist, or by
 * missing one that does because we printed the wrong deadline. So the model is
 * never trusted to produce a fact — only to *reformat* text we actually
 * fetched. Two hard gates in code, not in prompt wording:
 *
 *   1. A scheme whose `link` host is not one of the pages we genuinely read is
 *      dropped. This is the one that matters: asked for scheme links, a model
 *      will happily mint `https://karnatakaagri.gov.in/krishi-bhagya`, which
 *      looks right and 404s.
 *   2. A scheme with no name or no benefit is dropped, rather than rendered as
 *      a card with blanks in it.
 *
 * And the eight built-ins are a floor, never a fallback to be replaced: they
 * are always present, live schemes are added around them, and a live result
 * that collides with one is discarded rather than duplicating the card.
 *
 * ── Why there is no paid rung here ───────────────────────────────────────────
 *
 * There was one, aimed at myscheme.gov.in, because the free Fetch tier reads
 * that site as 222 characters of chrome and footer — a textbook case for a
 * browser agent. It was removed after being measured rather than assumed:
 *
 *   run against /search/category/Agriculture,Rural & Environment
 *   → HTTP 200, status COMPLETED, 3 steps, 70 s wall, result {"schemes": []}
 *
 * The agent reaches the site and comes back empty, the same way
 * `/api/live-mandi` comes back empty against agmarknet.gov.in. Two further
 * facts settled it: the run ignored `max_duration_seconds: 45` and took 70 s,
 * which is past the 60 s serverless function ceiling, and the free Search +
 * Fetch rungs already return real state schemes (a Karnataka run yields Krishi
 * Bhagya, Karnataka Raita Suraksha and three more, read off chitradurga.nic.in).
 *
 * So the paid tier would have cost roughly five cents per attempt to add
 * nothing, on a path that could not complete inside the function anyway. The
 * agent earns its place in `src/lib/inputPrices` instead, where it was measured
 * to work and the free tiers were measured not to.
 */

export type SchemeProvenance = "builtin" | "cache" | "search+fetch" | "agent" | "mixed";

export type SchemeDeskResult = {
  /** The built-in floor plus whatever live schemes were found, merged. */
  schemes: Scheme[];
  provenance: SchemeProvenance;
  /** ISO. What the UI prints as "last checked". */
  checkedAt: string;
  state: string | null;
  liveCount: number;
  ladder: TfRungLog[];
  costUsd: number;
};

/**
 * Seven days.
 *
 * Scheme catalogues move on a weeks-to-months timescale — a new state subsidy
 * is a budget announcement, not a price tick. A shorter TTL would spend
 * TinyFish credit re-learning an answer that had not changed.
 *
 * Widened from 7 days to 10 once the nightly warm job existed. A window
 * shorter than the refresh cycle means entries expire between passes and a
 * farmer still meets a cold cache — the warmer would be buying the same answer
 * back every week for nothing.
 */
const CACHE_TTL_SEC = 10 * 24 * 60 * 60;

/** Below this many characters a "page" is navigation chrome, not content. */
const MIN_PAGE_CHARS = 1200;

/** Enough live state schemes that climbing to the paid rung is not worth it. */
const SUFFICIENT_LIVE = 3;

/** Never add more than this many live schemes to the eight built-ins. */
const MAX_LIVE = 12;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CATEGORIES: Scheme["category"][] = [
  "Income Support",
  "Insurance",
  "Credit",
  "Subsidy",
  "Advisory",
];

// ─── Cache ───────────────────────────────────────────────────────────────────

const cacheKey = (state: string | null) => `v1:${slug(state ?? "india")}`;

type CacheRow = {
  schemes: Scheme[];
  provenance: SchemeProvenance;
  ladder: TfRungLog[];
  cost_usd: number;
  checked_at: string;
  expires_at: string;
};

async function readCache(state: string | null): Promise<CacheRow | null> {
  const admin = hazardAdmin();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("scheme_cache")
      .select("schemes, provenance, ladder, cost_usd, checked_at, expires_at")
      .eq("key", cacheKey(state))
      .maybeSingle();
    const row = data as CacheRow | null;
    if (!row || !Array.isArray(row.schemes)) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row;
  } catch {
    // Table not migrated yet — behave as a miss, exactly as stores.ts does.
    return null;
  }
}

async function writeCache(
  state: string | null,
  schemes: Scheme[],
  provenance: SchemeProvenance,
  ladder: TfRungLog[],
  costUsd: number
): Promise<void> {
  const admin = hazardAdmin();
  // An empty result is not cached. Caching "we found nothing" would suppress
  // the next attempt for a week, and the usual cause of nothing is a transient
  // upstream failure rather than a state with no schemes.
  if (!admin || schemes.length === 0) return;
  try {
    await admin.from("scheme_cache").upsert(
      {
        key: cacheKey(state),
        state: state ?? "India",
        schemes,
        provenance,
        ladder,
        cost_usd: costUsd,
        checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_SEC * 1000).toISOString(),
      },
      { onConflict: "key", ignoreDuplicates: false }
    );
  } catch {
    /* caching is an optimisation; the caller already has the data */
  }
}

// ─── Merge ───────────────────────────────────────────────────────────────────

/**
 * The built-in eight first, always, then live schemes around them.
 *
 * Collision handling is the point: a state portal page very often describes
 * PM-KISAN alongside its own schemes, and without this the board would show two
 * PM-KISAN cards — one curated, one scraped, disagreeing about the deadline.
 * The built-in wins, because it was checked by a person.
 */
function merge(live: Scheme[]): Scheme[] {
  const builtin: Scheme[] = SCHEMES.map((s) => ({
    ...s,
    source: "builtin" as const,
    scope: "central" as const,
  }));

  const takenNames = new Set(builtin.map((s) => normaliseName(s.name)));
  // Link collisions are checked against the BUILT-INS ONLY, and this is not a
  // detail. Several schemes are routinely described on one department page, so
  // they legitimately share a link — a Karnataka district page yielded seven
  // schemes all pointing at /en/agriculture/. Accumulating live links into this
  // set made each one look like a duplicate of the last and threw six of the
  // seven away. Name is the identity of a scheme; its link is just where we
  // read about it.
  const builtinLinks = new Set(builtin.map((s) => linkKey(s.link)));

  const added: Scheme[] = [];
  for (const s of live) {
    const name = normaliseName(s.name);
    if (takenNames.has(name) || builtinLinks.has(linkKey(s.link))) continue;
    takenNames.add(name);
    added.push(s);
    if (added.length >= MAX_LIVE) break;
  }

  return [...builtin, ...added];
}

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function linkKey(link: string): string {
  try {
    const u = new URL(link);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return link;
  }
}

function builtinOnly(state: string | null, ladder: TfRungLog[] = []): SchemeDeskResult {
  return {
    schemes: merge([]),
    provenance: "builtin",
    checkedAt: new Date().toISOString(),
    state,
    liveCount: 0,
    ladder,
    costUsd: 0,
  };
}

// ─── Read path (cheap, never calls TinyFish) ─────────────────────────────────

/**
 * What the Schemes page calls on mount. One DB read, or the built-in floor.
 * Never spends anything, so it is safe to call on every render.
 */
export async function readSchemeDesk(state: string | null): Promise<SchemeDeskResult> {
  const row = await readCache(state);
  if (!row) return builtinOnly(state);

  return {
    schemes: merge(row.schemes),
    provenance: "cache",
    checkedAt: row.checked_at,
    state,
    liveCount: row.schemes.length,
    ladder: Array.isArray(row.ladder) ? row.ladder : [],
    costUsd: Number(row.cost_usd) || 0,
  };
}

// ─── The ladder ──────────────────────────────────────────────────────────────

/** Hosts worth reading, scored. Anything scoring zero is not fetched at all. */
function hostScore(host: string): number {
  if (host.endsWith(".gov.in") || host.endsWith(".nic.in")) return 3;
  // Zero, despite being the national aggregator and an obvious .gov.in: it is
  // a client-rendered app that Fetch reads as 222 characters of chrome, and a
  // measured browser-agent run against it returned {"schemes": []} too. Reading
  // it costs one of the six fetch slots and has never yet produced a scheme.
  if (host === "myscheme.gov.in") return 0;
  if (/(^|\.)(schemesinindia\.in|farmizen\.com|bighaat\.com)$/.test(host)) return 1;
  return 0;
}

/** Eighteen months back. Older pages describe schemes that have since closed. */
function afterDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 18);
  return d.toISOString().slice(0, 10);
}

async function discover(state: string | null): Promise<TfSearchResult[]> {
  const where = state ?? "India";
  const queries = [
    `${where} government agriculture scheme subsidy for farmers apply online`,
    `${where} krishi raita department farmer scheme eligibility benefit`,
    `${where} farmer subsidy scheme list benefit eligibility how to apply`,
  ];

  const batches = await Promise.all(
    queries.map((q) =>
      tfSearch(q, {
        location: "IN",
        language: "en",
        domainType: "web",
        // Deliberately a date filter and not `recencyMinutes` — the API rejects
        // the two together, and the type union here makes that a compile error.
        afterDate: afterDate(),
        label: "tf/schemes",
      })
    )
  );

  // Deduped by host+path, then ranked by how official the host is. This
  // selection is deterministic on purpose: which pages we are willing to read
  // is a trust decision, and a trust decision should not be delegated to a
  // model that has already been told to summarise whatever it is handed.
  const seen = new Set<string>();
  return batches
    .flat()
    .filter((r) => {
      const key = linkKey(r.url);
      if (seen.has(key) || hostScore(hostOf(r.url)) === 0) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => hostScore(hostOf(b.url)) - hostScore(hostOf(a.url)));
}

/**
 * Turns fetched page text into Scheme rows.
 *
 * `allowedHosts` is the anti-fabrication gate and must contain every host we
 * actually read, `final_url` included — a redirect means the page we got is not
 * at the URL we asked for, and a scheme cited to the pre-redirect host would be
 * rejected for the wrong reason.
 */
async function normalise(
  pages: TfFetchPage[],
  allowedHosts: Set<string>,
  state: string | null
): Promise<Scheme[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || pages.length === 0) return [];

  // Three pages at 5 000 chars, not four at 6 000.
  //
  // Measured: a 24 000-char corpus made Groq's JSON mode answer
  // `400 Failed to generate JSON` — the completion ran past its budget and a
  // truncated object is not valid JSON, so the whole rung returned nothing
  // even though the pages had been read successfully. Smaller input and an
  // explicit completion budget keep the answer inside the window.
  const corpus = pages
    .slice(0, 3)
    .map((p, i) => `--- SOURCE ${i + 1} (${p.final_url}) ---\n${p.text.slice(0, 5000)}`)
    .join("\n\n");

  const prompt = `You extract Indian government agriculture schemes from the text of official web pages.

${corpus}

Return ONLY JSON: {"schemes":[{"name","short","benefit","eligibility":[],"deadline","authority","link","category"}]}

Rules:
- Use ONLY facts stated in the text above. If a field is not stated, return an empty string, or an empty array for eligibility.
- NEVER infer or guess a deadline, a rupee amount, or an eligibility rule. An empty string is correct; an invented value is not.
- "link" must be a URL that appears in the text above, or the SOURCE url the scheme was described on. Do not construct a URL.
- "category" must be one of: ${CATEGORIES.join(", ")}.
- "short" is under 12 words. "benefit" is one sentence.
- Return at most 8 schemes.
- Skip anything that is not a government scheme for farmers.
- These are ALREADY KNOWN. Do not return them, and do not return a renamed or translated version of them: ${SCHEMES.map((s) => s.name).join("; ")}.
- Spend every slot on schemes specific to ${state ?? "India"} — state department schemes, state subsidies, state-level components of central programmes.`;

  // Tried with JSON mode first, then once without it.
  //
  // JSON mode is stricter and worth having, but it fails *closed*: if the
  // completion is cut short, Groq answers 400 rather than handing back the
  // partial text, and the rung loses pages it had already paid to read. The
  // second attempt drops the constraint and parses leniently, which is how
  // /api/scheme-match has always handled this model.
  const raw =
    (await askGroq(apiKey, prompt, true)) ?? (await askGroq(apiKey, prompt, false));
  if (!raw) return [];

  const list = (parseSchemeList(raw) as { schemes?: unknown })?.schemes;
  if (!Array.isArray(list)) return [];

  // One corpus goes to the model, so which page a scheme came from has to be
  // recovered from its link host rather than tracked through the call.
  const pageByHost = new Map<string, string>();
  for (const p of pages) {
    pageByHost.set(hostOf(p.final_url), p.final_url);
    pageByHost.set(hostOf(p.url), p.final_url);
  }

  return list
    .map((r) => {
      const link = typeof (r as Record<string, unknown>)?.link === "string"
        ? ((r as Record<string, unknown>).link as string)
        : "";
      return validateScheme(r, allowedHosts, state, pageByHost.get(hostOf(link)) ?? "");
    })
    .filter((s): s is Scheme => s !== null);
}

/** One Groq call. Returns null on any failure, so the caller can try again or give up. */
async function askGroq(apiKey: string, prompt: string, jsonMode: boolean): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      GROQ_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [
            { role: "system", content: "Return valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          // Enough for eight schemes with eligibility lists, and a bound that
          // stops a rambling answer from being truncated into invalid JSON.
          max_tokens: 4000,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      },
      { label: `groq/scheme-desk${jsonMode ? "" : ":lenient"}` }
    );
    // readGroqContent throws when `content` is null, which is an ordinary
    // outcome of a model call rather than a server fault. Catching it here
    // turns it into an empty rung instead of a 500, the way scheme-match
    // already reasons about unparseable output.
    return await readGroqContent(res, "groq/scheme-desk");
  } catch (e) {
    console.warn(`tf/schemes: normalise failed — ${(e as Error)?.message || "unknown"}`);
    return null;
  }
}

/** Tolerates a fenced or prose-wrapped object, as scheme-match's safeParse does. */
function parseSchemeList(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(cleaned.slice(a, b + 1));
  } catch {
    return null;
  }
}

/**
 * The gate. Everything a model produced passes through here before a farmer
 * can see it, and anything that cannot be traced back to a page we read is
 * dropped rather than shown with a caveat.
 */
function validateScheme(
  raw: unknown,
  allowedHosts: Set<string>,
  state: string | null,
  sourceUrl: string
): Scheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const name = str(r.name, 120);
  const benefit = str(r.benefit, 400);
  const link = str(r.link, 400);
  // A card with no name or no benefit is not information, it is a blank with a
  // border. Dropping it is the honest outcome.
  if (!name || !benefit || !link) return null;

  // The important one: the link must point at a host we genuinely fetched.
  if (!allowedHosts.has(hostOf(link))) return null;

  const category = CATEGORIES.includes(r.category as Scheme["category"])
    ? (r.category as Scheme["category"])
    : "Subsidy";

  const eligibility = Array.isArray(r.eligibility)
    ? r.eligibility.map((e) => str(e, 160)).filter(Boolean).slice(0, 6)
    : [];

  return {
    id: `live-${slug(name)}`,
    name,
    short: str(r.short, 200) || benefit.slice(0, 120),
    category,
    benefit,
    eligibility,
    deadline: str(r.deadline, 120),
    authority: str(r.authority, 160),
    link,
    source: "live",
    sourceUrl,
    scope: "state",
    state: state ?? "",
  };
}

// ─── Refresh path (climbs the ladder, can spend) ─────────────────────────────

export async function refreshSchemeDesk(
  state: string | null,
  // `budget` is unused today — both remaining rungs are free. It stays in the
  // signature because the caller already owns a ceiling for the request, and a
  // future paid rung should be handed that ceiling rather than inventing one.
  _opts: { allowAgent: boolean; budget: TfBudget }
): Promise<SchemeDeskResult> {
  if (!anyKeyConfigured()) return builtinOnly(state);

  // Carried from the Search rung to the Fetch rung.
  let candidates: TfSearchResult[] = [];

  const rungs: TfRung<Scheme[]>[] = [
    {
      tier: "search",
      label: "discover scheme pages",
      sufficient: () => false, // discovery only — always fall through to Fetch
      run: async () => {
        candidates = await discover(state);
        return { value: null, detail: `${candidates.length} candidates` };
      },
    },
    {
      tier: "fetch",
      label: "read scheme pages",
      shouldRun: () => candidates.length > 0,
      sufficient: (v) => v.length >= SUFFICIENT_LIVE,
      run: async () => {
        // Eight, not six. Measured: on a Karnataka run, four of six
        // candidates answered proxy_error or target_unreachable — several
        // *.karnataka.gov.in hosts refuse the fetch proxy outright. Fetch is
        // free and batched, so over-asking costs nothing and is the difference
        // between one readable page and four.
        const urls = candidates.slice(0, 8).map((c) => c.url);
        // A day-old copy of a scheme page is not stale, and the TTL keeps a
        // retry after a Groq hiccup from re-reading six pages.
        const { pages, errors } = await tfFetch(urls, { ttl: 86_400, label: "tf/schemes" });

        const readable = pages.filter((p) => p.text.length >= MIN_PAGE_CHARS);
        const thin = pages.filter((p) => p.text.length < MIN_PAGE_CHARS);

        const hosts = new Set<string>();
        for (const p of readable) {
          hosts.add(hostOf(p.url));
          hosts.add(hostOf(p.final_url));
        }

        const schemes = await normalise(readable, hosts, state);

        // Every failure is named, because "this government site blocked us" is
        // information, and silently showing six schemes instead of eight is not.
        const detail = [
          `${readable.length}/${urls.length} readable`,
          thin.length ? `${thin.length} thin` : "",
          ...errors.map((e) => `${hostOf(e.url)} ${e.error}${e.status ? ` ${e.status}` : ""}`),
          `${schemes.length} schemes`,
        ]
          .filter(Boolean)
          .join(", ");

        return { value: schemes.length ? schemes : null, detail };
      },
    },
  ];

  const { value, via, log, costUsd } = await runLadder(rungs, { label: "tf/schemes" });
  const live = value ?? [];

  if (!live.length) return builtinOnly(state, log);

  const provenance: SchemeProvenance =
    via === "agent" ? "agent" : via === "fetch" ? "search+fetch" : "mixed";

  await writeCache(state, live, provenance, log, costUsd);

  return {
    schemes: merge(live),
    provenance,
    checkedAt: new Date().toISOString(),
    state,
    liveCount: live.length,
    ladder: log,
    costUsd,
  };
}
