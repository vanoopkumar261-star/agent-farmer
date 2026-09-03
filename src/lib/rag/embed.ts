import "server-only";

/**
 * Client for the `embed` Supabase Edge Function.
 *
 * Groq — which runs every other AI call in this app — has no embedding models
 * and no /v1/embeddings endpoint, so the vectors come from Supabase's Edge
 * Runtime instead, where `gte-small` runs natively. That is the whole reason
 * retrieval here costs nothing: no second vendor, no extra key, no per-call fee.
 *
 * Measured against the deployed function: 384 dimensions, L2 norm exactly
 * 1.000000. The vectors being unit length is what lets Postgres rank with inner
 * product (`<#>`) instead of cosine — same order, cheaper operator.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Confirmed by calling the function, not read off a model card. */
export const EMBED_DIMS = 384;

/**
 * Eight, and not more — measured, not guessed.
 *
 * The Edge Runtime embeds sequentially and enforces a CPU budget per
 * invocation. Against the deployed function:
 *
 *   8  texts → HTTP 200 in 1.32s
 *   16 texts → HTTP 200 in 2.29s
 *   32 texts → HTTP 546  (Supabase's resource-limit code) at 2.28s
 *
 * The first indexing run used 32 and silently lost 64 of 76 chunks. Eight
 * leaves real headroom, and the whole corpus still indexes in about ten calls.
 */
const BATCH = 8;
const TIMEOUT_MS = 60_000;
/** One retry, for the cold start that returns 503 on the first call. */
const RETRIES = 1;
const RETRY_DELAY_MS = 1_200;

async function callEmbed(texts: string[], attempt = 0): Promise<number[][] | null> {
  if (!URL_BASE || !SERVICE_KEY) return null;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/embed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts }),
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // 503 is the cold boot; 546 is the resource limit, which means the batch
      // was too big and retrying it unchanged would fail the same way.
      if (res.status >= 500 && res.status !== 546 && attempt < RETRIES) {
        clearTimeout(timer);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return callEmbed(texts, attempt + 1);
      }
      console.error(`EMBED http ${res.status} (batch of ${texts.length})`);
      return null;
    }
    const j = await res.json();
    const vectors = j?.embeddings;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) return null;

    // A width mismatch means the model changed under us. Better to fail loudly
    // here than to write vectors Postgres will reject, or — worse — that it
    // accepts into a differently-shaped index and ranks as noise.
    if (vectors[0]?.length !== EMBED_DIMS) {
      console.error(`EMBED dimension mismatch: got ${vectors[0]?.length}, expected ${EMBED_DIMS}`);
      return null;
    }
    return vectors as number[][];
  } catch (e: any) {
    console.error("EMBED failed:", e?.message ?? e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Embed one string. Null on any failure — callers degrade, never throw. */
export async function embedOne(text: string): Promise<number[] | null> {
  const out = await callEmbed([text]);
  return out?.[0] ?? null;
}

/** Embed many, in batches the function will accept. */
export async function embedMany(texts: string[]): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vectors = await callEmbed(slice);
    if (vectors) out.push(...vectors);
    else out.push(...slice.map(() => null));
  }
  return out;
}

/** pgvector accepts a bracketed list; JSON arrays serialise to exactly that. */
export const toVectorLiteral = (v: number[]) => JSON.stringify(v);
