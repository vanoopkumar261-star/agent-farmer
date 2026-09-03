import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne, toVectorLiteral } from "./embed";
import { fetchWithRetry, GROQ_TEXT_MODEL, readGroqContent } from "@/lib/http";

/**
 * Finding the passages that actually answer a farmer's question.
 *
 * Every constant in this file came out of measuring the real indexed corpus,
 * because the obvious approaches all failed in ways that were invisible from
 * the code.
 *
 * ── Why not a similarity threshold ───────────────────────────────────────────
 * The tempting design is "take the top vector match if it scores above X".
 * Measured on 76 real chunks, that cannot work:
 *
 *   "how do I get a bank loan to build a cold storage"   top1 0.8238  ← COVERED
 *   "which tractor should I buy for 5 acres"             top1 0.8192  ← absent
 *   "what price will onions fetch next month"            top1 0.8684  ← absent
 *
 * The covered question scores *below* two questions the corpus cannot answer.
 * Any threshold either throws away the Agriculture Infrastructure Fund — which
 * is precisely the right answer, its text reads "post-harvest infra (storage,
 * cold chain)" — or serves a page about growing onions to someone asking about
 * onion prices.
 *
 * ── Why not keyword rank either ──────────────────────────────────────────────
 * Same story inverted. The tractor question's best keyword hit ranks 0.0406;
 * the correct cold-storage hit ranks 0.0329. The junk outranks the answer.
 *
 * ── What actually separates them: agreement ──────────────────────────────────
 * Two independent retrievers — dense vectors and Postgres full-text — are run
 * over the same corpus, and what matters is how much their top-8 lists OVERLAP:
 *
 *   covered queries        7, 7, 3, 7, 6
 *   on-topic but absent    1, 1
 *   off-topic              0
 *
 * Clean separation with nothing in between. Semantic similarity and lexical
 * overlap are different kinds of wrong, so when both independently surface the
 * same passage, it is almost certainly the right one — and when they disagree,
 * neither is confident and the honest answer is to retrieve nothing.
 */

/** Passages each retriever considers before they are compared. */
const CANDIDATES = 8;
/**
 * Minimum overlap between the two lists to accept the query as covered.
 * Measured floor for a covered query is 3; ceiling for an absent one is 1.
 */
const MIN_AGREEMENT = 2;
/** Passages handed to the model. More is not better — it dilutes the prompt. */
const MAX_PASSAGES = 4;
/** Standard reciprocal-rank-fusion damping. */
const RRF_K = 60;

export type Passage = {
  source: "scheme" | "library" | "agronomy";
  sourceId: string;
  title: string;
  parent: string | null;
  link: string | null;
  content: string;
};

export type Retrieved = {
  passages: Passage[];
  /** The farmer's own earlier words. Context only — never cited. */
  memory: string[];
  /** For logging: retrieval failing silently is the main risk in a RAG system. */
  debug: { query: string; agreement: number; vecTop: number };
};

const EMPTY: Retrieved = { passages: [], memory: [], debug: { query: "", agreement: 0, vecTop: 0 } };

/**
 * Rewrite the farmer's message into a short English search query.
 *
 * This step is not optional, and skipping it is how a multilingual RAG system
 * quietly does nothing. The corpus and the embedding model (`gte-small`) are
 * both English; the app serves nine Indian languages. A question typed in
 * Kannada embeds nowhere near an English passage about vermicompost, retrieval
 * returns nothing, the assistant answers from memory as before, and no error is
 * ever raised.
 *
 * It also strips conversational padding, which helps even in English:
 *   "my leaves are going yellow what do i do"
 *     → "yellow leaves nutrient deficiency treatment"
 *
 * Falls back to the raw message if Groq is unavailable — degraded, not broken.
 */
async function toSearchQuery(message: string, apiKey: string): Promise<string> {
  const raw = message.trim().slice(0, 500);
  if (!raw) return "";
  try {
    const res = await fetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          temperature: 0,
          // `reasoning_effort: low` and a budget far larger than the output.
          // GROQ_TEXT_MODEL is a reasoning model, and reasoning tokens are spent
          // from max_tokens BEFORE any visible text — so a budget sized for the
          // 6-word answer (40) returned content:"" with finish_reason:"length"
          // every single time. English queries still worked, because the raw
          // question embeds fine, which is exactly why the breakage was
          // invisible until a Kannada question retrieved nothing.
          reasoning_effort: "low",
          max_tokens: 512,
          messages: [
            {
              role: "system",
              content: [
                "Rewrite the farmer's message as a short English search query (3-8 words) for a farming knowledge base.",
                "",
                "TRANSLATE THE MEANING into standard English agricultural terms. Never transliterate an Indian-language word into Latin letters, and never guess a botanical name from how a word sounds — both produce a query that matches nothing.",
                "",
                "Examples:",
                'हिन्दी: "केंचुआ खाद तैयार होने में कितने दिन लगते हैं?" -> vermicompost ready time duration',
                'ಕನ್ನಡ: "ಎರೆಹುಳು ಗೊಬ್ಬರ ಸಿದ್ಧವಾಗಲು ಎಷ್ಟು ದಿನ ಬೇಕು?" -> vermicompost ready time duration',
                'हिन्दी: "मेरी गेहूं की फसल में पीले पत्ते हैं" -> wheat yellow leaves nutrient deficiency',
                'English: "am I eligible for PM-KISAN?" -> PM-KISAN eligibility small farmers',
                "",
                "Keep crop names, scheme names and technical terms. Output ONLY the query — no quotes, no punctuation, no explanation.",
              ].join("\n"),
            },
            { role: "user", content: raw },
          ],
        }),
      },
      { retries: 1 }
    );
    const out = (await readGroqContent(res, "rag-rewrite")).trim().replace(/^["']|["']$/g, "");
    if (out.length >= 2 && out.length <= 200) return out;
    console.warn(`RAG rewrite returned unusable text; falling back to raw query`);
    return raw;
  } catch (e: any) {
    // Loud on purpose. A failed rewrite is survivable in English and fatal in
    // every other language, and it produces no error anywhere downstream —
    // retrieval simply returns nothing and the assistant answers from memory.
    console.error(`RAG rewrite failed (${e?.message ?? e}) — non-English retrieval will not work`);
    return raw;
  }
}

type Row = {
  source: string;
  source_id: string;
  title: string;
  parent: string | null;
  link: string | null;
  content: string;
  similarity?: number;
  rank?: number;
};

const keyOf = (r: Row) => `${r.source}:${r.source_id}`;

export async function retrieve(
  supabase: SupabaseClient,
  message: string,
  farmerId: string | null
): Promise<Retrieved> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return EMPTY;

  const query = await toSearchQuery(message, apiKey);
  if (!query) return EMPTY;

  const vector = await embedOne(query);
  if (!vector) {
    console.warn("RAG: embedding unavailable — answering without sources");
    return EMPTY;
  }
  const literal = toVectorLiteral(vector);

  const [vecRes, kwRes, memRes] = await Promise.allSettled([
    supabase.rpc("match_knowledge", { query_embedding: literal, match_count: CANDIDATES }),
    supabase.rpc("match_knowledge_keyword", {
      query_text: query,
      match_count: CANDIDATES,
      min_rank: 0,
    }),
    farmerId
      ? supabase.rpc("match_farmer_memory", { query_embedding: literal, match_count: 2 })
      : Promise.resolve({ data: [] } as any),
  ]);

  const vec: Row[] =
    vecRes.status === "fulfilled" ? ((vecRes.value as any)?.data ?? []) : [];
  const kw: Row[] = kwRes.status === "fulfilled" ? ((kwRes.value as any)?.data ?? []) : [];

  const vecKeys = vec.map(keyOf);
  const kwKeys = kw.map(keyOf);
  const agreement = vecKeys.filter((k) => kwKeys.includes(k)).length;
  const vecTop = vec[0]?.similarity ?? 0;

  if (agreement < MIN_AGREEMENT) {
    // Not covered. Returning nothing is the point: an irrelevant passage in the
    // prompt invites the model to answer a question the farmer did not ask,
    // using text that merely shares vocabulary.
    console.log(`RAG miss: "${query}" agreement=${agreement} vecTop=${vecTop.toFixed(3)}`);
    return { passages: [], memory: [], debug: { query, agreement, vecTop } };
  }

  // Reciprocal rank fusion. A passage in both lists is scored twice and rises
  // above anything either retriever found alone — which is exactly the signal
  // the agreement gate is built on.
  const fused = new Map<string, number>();
  const byKey = new Map<string, Row>();
  vecKeys.forEach((k, i) => {
    fused.set(k, (fused.get(k) ?? 0) + 1 / (RRF_K + i + 1));
    byKey.set(k, vec[i]);
  });
  kwKeys.forEach((k, i) => {
    fused.set(k, (fused.get(k) ?? 0) + 1 / (RRF_K + i + 1));
    if (!byKey.has(k)) byKey.set(k, kw[i]);
  });

  // Array.from rather than spread: the project's tsc target does not enable
  // downlevelIteration, so spreading a Map iterator fails to compile.
  const passages: Passage[] = Array.from(fused.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PASSAGES)
    .map(([k]) => byKey.get(k)!)
    .filter(Boolean)
    .map((r) => ({
      source: r.source as Passage["source"],
      sourceId: r.source_id,
      title: r.title,
      parent: r.parent,
      link: r.link,
      content: r.content,
    }));

  const memory: string[] =
    memRes.status === "fulfilled"
      ? (((memRes.value as any)?.data ?? []) as { content: string }[]).map((m) => m.content)
      : [];

  console.log(
    `RAG hit: "${query}" agreement=${agreement} vecTop=${vecTop.toFixed(3)} passages=${passages.length}`
  );
  return { passages, memory, debug: { query, agreement, vecTop } };
}

/**
 * The block appended to the system prompt.
 *
 * Two separations are deliberate. Retrieved passages are presented as sources
 * the model may cite; the farmer's own past conversation is presented as
 * conversation and explicitly not citable — quoting the assistant's own earlier
 * answer back as evidence would launder a previous mistake into a reference.
 */
export function buildSourceBlock(r: Retrieved): string {
  if (!r.passages.length && !r.memory.length) return "";

  const parts: string[] = [];

  if (r.passages.length) {
    parts.push(
      "REFERENCE SOURCES — these come from Agent Farmer's own handbooks, scheme records and crop data.",
      "Prefer them over your own knowledge. Name the source you used, e.g. \"from the Vermicompost Mastery handbook\" or \"per the PM-KISAN record\".",
      "If they do NOT answer the question, say so plainly and answer from general knowledge instead — do not stretch a source to fit.",
      ...r.passages.map(
        (p, i) =>
          `[${i + 1}] ${p.parent ? `${p.parent} — ` : ""}${p.title}\n${p.content}`
      )
    );
  }

  if (r.memory.length) {
    parts.push(
      "",
      "EARLIER IN YOUR CONVERSATION WITH THIS FARMER (for continuity only — this is your own past wording, never cite it as a source):",
      ...r.memory.map((m) => `- ${m.slice(0, 400)}`)
    );
  }

  return parts.join("\n");
}
