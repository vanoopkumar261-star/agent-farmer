/**
 * Text embeddings for the assistant's knowledge retrieval.
 *
 * This is the one piece of the app that cannot live in Next.js, and it is worth
 * being explicit about why: Groq — which powers everything else here — has no
 * embedding models and no /v1/embeddings endpoint. Supabase's Edge Runtime
 * ships `gte-small` natively, so this function is the whole reason retrieval
 * costs nothing: no external embedding API, no second API key, no per-call fee.
 *
 * Called from two places:
 *   - scripts/index-knowledge.mjs, in batches, when re-indexing the corpus
 *   - the chat route, one string at a time, to embed a farmer's question
 *
 * `normalize: true` returns unit-length vectors, which lets pgvector's inner
 * product (`<#>`) stand in for cosine distance — the cheaper operator, same
 * ranking.
 *
 * Deploy:  npx supabase functions deploy embed --project-ref <ref>
 */

// The Edge Runtime injects this global; it has no npm package to import.
declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts: Record<string, unknown>): Promise<number[]> } };
};

const MAX_TEXTS = 64;
/** Guards against one oversized chunk blowing the request out. */
const MAX_CHARS = 8_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let texts: string[];
  try {
    const body = await req.json();
    texts = Array.isArray(body?.texts) ? body.texts : typeof body?.text === "string" ? [body.text] : [];
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  texts = texts
    .filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.slice(0, MAX_CHARS));

  if (texts.length === 0) return json({ error: "no texts" }, 400);
  if (texts.length > MAX_TEXTS) return json({ error: `max ${MAX_TEXTS} texts per call` }, 400);

  try {
    const session = new Supabase.ai.Session("gte-small");
    const embeddings: number[][] = [];
    for (const text of texts) {
      // Sequential on purpose: the runtime shares one model instance, and
      // firing these in parallel buys nothing but memory pressure.
      const vector = (await session.run(text, {
        mean_pool: true,
        normalize: true,
      })) as number[];
      embeddings.push(vector);
    }

    return json({
      embeddings,
      // Returned so the caller never has to assume the model's width — the
      // Postgres column type is fixed at creation and a mismatch is a migration
      // to undo, so this is read once and the schema is built to match.
      dims: embeddings[0]?.length ?? 0,
      model: "gte-small",
    });
  } catch (e) {
    console.error("EMBED failed:", e);
    return json({ error: "embedding failed" }, 500);
  }
});
