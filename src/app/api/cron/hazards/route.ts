import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { fetchCapAlert, fetchCapFeed } from "@/lib/hazards/cap";
import { hazardAdmin, knownGuids, pruneExpired, storeHazards } from "@/lib/hazards/store";
import type { HazardAlert } from "@/lib/hazards/types";

/**
 * Hazard poller.
 *
 * Called on a schedule by `.github/workflows/hazard-poll.yml` — not by Vercel
 * Cron, which on the Hobby plan runs at most once a day and cannot deliver a
 * two-hour thunderstorm warning.
 *
 * Ingest only. This route fills `hazard_events`; matching alerts to farmers and
 * notifying them are separate steps, so a fault here can never spam anyone.
 *
 * Runs are idempotent by design: only guids absent from the table get a detail
 * fetch, and the write is an upsert on (source, source_guid). Running it twice
 * in a row is a no-op — see the verification notes in the plan.
 */

export const dynamic = "force-dynamic";
// Detail fetches are sequential-ish and SACHET is not fast; give it room.
export const maxDuration = 60;

/** Cap on detail fetches per run, so a feed spike can't blow the time budget. */
const MAX_DETAIL_FETCHES = 40;
/** Small, to stay polite to a government feed with no published SLA. */
const CONCURRENCY = 4;

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws on length mismatch, which would itself leak the
 * expected length, so both sides are hashed to a fixed width first — cheaper
 * than importing a comparison library for one call.
 */
function secretOk(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Run tasks with a small concurrency cap, preserving nothing but completion. */
async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out.push(await fn(items[i]));
    }
  });
  await Promise.all(workers);
  return out;
}

async function run(req: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail closed. An unset secret would otherwise leave the route open.
    console.error("CRON_SECRET is not set — hazard poller refused to run.");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const header = req.headers.get("authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim() ?? null;
  if (!secretOk(token, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = hazardAdmin();
  if (!admin) {
    return NextResponse.json({ error: "supabase service key missing" }, { status: 503 });
  }

  const startedAt = Date.now();

  const feed = await fetchCapFeed();
  if (feed.length === 0) {
    // Upstream down or shape changed. Report it rather than claiming success —
    // a silent zero here would look identical to "no hazards in India today".
    return NextResponse.json(
      { ok: false, reason: "empty feed", feedItems: 0, ms: Date.now() - startedAt },
      { status: 502 }
    );
  }

  const seen = await knownGuids(
    admin,
    "cap",
    feed.map((f) => f.guid)
  );
  const fresh = feed.filter((f) => !seen.has(f.guid)).slice(0, MAX_DETAIL_FETCHES);

  const alerts: HazardAlert[] = await pooled(fresh, CONCURRENCY, fetchCapAlert);
  const stored = await storeHazards(admin, alerts);
  const pruned = await pruneExpired(admin);

  return NextResponse.json({
    ok: true,
    feedItems: feed.length,
    alreadyKnown: seen.size,
    fetched: fresh.length,
    stored,
    pruned,
    ms: Date.now() - startedAt,
  });
}

// POST is the real entry point; GET mirrors it so the route can be checked from
// a browser or curl during setup without a second code path.
export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}
