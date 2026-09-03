import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { buildAllChunks } from "@/lib/rag/chunk";
import { embedMany, toVectorLiteral } from "@/lib/rag/embed";
import { hazardAdmin } from "@/lib/hazards/store";

/**
 * Rebuilds the assistant's searchable knowledge.
 *
 * Run by hand after editing a scheme, a handbook page or a crop profile:
 *
 *   curl -X POST http://localhost:3000/api/admin/reindex \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * This is a route rather than a standalone script for a concrete reason:
 * `cropCatalog.ts` imports `"./agronomy"` with no file extension. TypeScript
 * and webpack resolve that; Node's ESM loader does not, so a plain `node`
 * script cannot import the knowledge sources at all. Inside Next the imports
 * resolve normally, which is worth more than the tidiness of a script.
 *
 * Guarded by the same shared secret as the hazard poller, since it costs
 * embedding work and writes shared reference data.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function secretOk(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? null;
  if (!secretOk(token, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = hazardAdmin();
  if (!admin) return NextResponse.json({ error: "service key missing" }, { status: 503 });

  const started = Date.now();
  const chunks = buildAllChunks();

  // Only embed what actually changed. Re-running after a one-line edit should
  // cost one embedding, not eighty.
  let existing = new Map<string, string>();
  try {
    const { data } = await admin.from("knowledge_chunks").select("source, source_id, content_hash");
    for (const r of data ?? []) {
      existing.set(`${(r as any).source}:${(r as any).source_id}`, (r as any).content_hash);
    }
  } catch {
    /* table absent — treat everything as new */
  }

  const stale = chunks.filter(
    (c) => existing.get(`${c.source}:${c.sourceId}`) !== c.contentHash
  );

  if (stale.length === 0) {
    return NextResponse.json({
      ok: true,
      total: chunks.length,
      embedded: 0,
      note: "everything already current",
      ms: Date.now() - started,
    });
  }

  const vectors = await embedMany(stale.map((c) => c.content));

  const rows = stale
    .map((c, i) => (vectors[i] ? { c, v: vectors[i]! } : null))
    .filter((x): x is { c: (typeof stale)[number]; v: number[] } => x !== null)
    .map(({ c, v }) => ({
      source: c.source,
      source_id: c.sourceId,
      title: c.title,
      parent: c.parent,
      link: c.link,
      content: c.content,
      content_hash: c.contentHash,
      embedding: toVectorLiteral(v),
    }));

  const failed = stale.length - rows.length;

  let written = 0;
  if (rows.length) {
    const { error, count } = await admin
      .from("knowledge_chunks")
      .upsert(rows, { onConflict: "source,source_id", count: "exact" });
    if (error) {
      console.error("REINDEX write failed:", error.message);
      return NextResponse.json({ error: "write failed", detail: error.message }, { status: 500 });
    }
    written = count ?? rows.length;
  }

  const bySource = chunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.source] = (acc[c.source] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    total: chunks.length,
    bySource,
    stale: stale.length,
    embedded: rows.length,
    written,
    failed,
    ms: Date.now() - started,
  });
}
