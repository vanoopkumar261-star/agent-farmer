import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cronAuth";
import { hazardAdmin } from "@/lib/hazards/store";
import { ALL_STATES } from "@/lib/market";
import { anyKeyConfigured } from "@/lib/tfKeys";
import { newBudget } from "@/lib/tinyfish";
import { refreshSchemeDesk } from "@/lib/schemeDesk";
import { startLiveMandi } from "@/lib/mandi/live";
import { startInputPrices } from "@/lib/inputPrices";

/**
 * Nightly TinyFish cache warmer.
 *
 * ── The problem it solves ────────────────────────────────────────────────────
 *
 * Every TinyFish feature in this app is cache-first, and until now the cache
 * was filled by whoever happened to ask. That worked for the one state being
 * demonstrated and badly for everyone else: a farmer in Bihar opening
 * /dashboard/schemes met an empty cache, waited ~25 seconds, and sometimes got
 * nothing. The data is identical for every farmer in a state, so making each
 * of them discover it individually is the wrong shape.
 *
 * This fills all of it overnight, so the first farmer of the day gets a
 * database read.
 *
 * ── Why it is free ───────────────────────────────────────────────────────────
 *
 * Only the free rungs run: `allowAgent: false` everywhere. A cron has no
 * signed-in user and an agent run is owned by one, by design — but the better
 * reason is that the breadth is already free. A state's scheme desk costs
 * nothing, and so does a mandi roll-up with its named high and low. Paying for
 * the last mile across 31 states nightly would spend real money on pages
 * nobody opened. A farmer who presses "check again" still escalates.
 *
 * ── Why a queue ──────────────────────────────────────────────────────────────
 *
 * This is minutes of work against a 60-second function, so the route drains
 * what it can and reports `remaining`; the workflow calls it again. See
 * 033_tf_warm_queue.sql.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stop taking new work at this point.
 *
 * The function ceiling is 60 s and a scheme item has been measured at 25-45 s,
 * so the cut-off has to leave a whole slow item's worth of room. Anything
 * started after this would still be running when the platform kills the
 * function, and the row would be stranded in `running`.
 *
 * Measured with the concurrent drain below: at a 15 s cut-off, passes ran to
 * 49.5 s wall — fine locally, uncomfortably close to the ceiling on Vercel.
 * At 10 s the worst case is one slow item claimed at 9.9 s, so ~55 s.
 */
const DEADLINE_MS = 10_000;

/**
 * Items warmed in parallel.
 *
 * These are independent network-bound lookups against different hosts, and
 * serially a pass managed only two of 75 targets. Four at a time keeps the
 * whole queue inside a dozen passes without hammering any single upstream —
 * the same reasoning as CONCURRENCY in the hazard poller.
 */
const CONCURRENCY = 4;

/**
 * A row claimed this long ago is assumed abandoned.
 *
 * A function killed mid-item leaves its row in `running` with nothing to
 * finish it, and `remaining` counts it forever — so the workflow would loop to
 * its iteration cap every night over one stuck row. Observed for real when a
 * curl timed out mid-pass during development.
 */
const STALE_RUNNING_MS = 5 * 60_000;

/** A hard ceiling per invocation, even though the free rungs should spend nothing. */
const WARM_MAX_USD = 0.5;

/** Give up on an item after this many tries, so one bad target cannot loop forever. */
const MAX_ATTEMPTS = 3;

/**
 * What gets warmed.
 *
 * Input terms and mandi crop/state pairs are the common cases, not everything:
 * the queue exists to make the app feel instant, not to mirror the web. States
 * come from ALL_STATES so this cannot drift from what the app recognises.
 */
const INPUT_TERMS: { category: "fertiliser" | "seed" | "pesticide"; term: string }[] = [
  { category: "fertiliser", term: "urea" },
  { category: "fertiliser", term: "DAP" },
  { category: "fertiliser", term: "potash" },
  { category: "fertiliser", term: "vermicompost" },
  { category: "seed", term: "tomato seeds" },
  { category: "seed", term: "paddy seeds" },
  { category: "seed", term: "maize seeds" },
  { category: "pesticide", term: "neem oil" },
];

/** The crops and states where a mandi board is most often asked for. */
const MANDI_CROPS = ["Tomato", "Onion", "Potato", "Paddy", "Maize", "Cotton"];
const MANDI_STATES = [
  "Karnataka",
  "Maharashtra",
  "Uttar Pradesh",
  "Punjab",
  "Madhya Pradesh",
  "Andhra Pradesh",
];

type QueueRow = { id: number; kind: string; target: string; attempts: number };

/**
 * Fills the queue, or resets a finished one.
 *
 * Idempotent by the (kind, target) unique key: a nightly run flips yesterday's
 * rows back to pending rather than growing the table.
 */
async function seed(db: NonNullable<ReturnType<typeof hazardAdmin>>): Promise<number> {
  const rows: { kind: string; target: string }[] = [];
  for (const state of ALL_STATES) rows.push({ kind: "scheme", target: state });
  for (const t of INPUT_TERMS) rows.push({ kind: "input", target: `${t.category}:${t.term}` });
  for (const crop of MANDI_CROPS) {
    for (const state of MANDI_STATES) rows.push({ kind: "mandi", target: `${crop}:${state}` });
  }

  const { error } = await db.from("tf_warm_queue").upsert(
    rows.map((r) => ({
      ...r,
      status: "pending",
      attempts: 0,
      last_error: null,
      cost_usd: 0,
      ran_at: null,
    })),
    { onConflict: "kind,target" }
  );
  // Reported, not swallowed. A silent seeding failure looks exactly like a
  // finished queue — "seeded 75, done 0, remaining 0" — and would have the
  // workflow report success every night while warming nothing.
  if (error) throw new Error(`seed failed: ${error.message}`);
  return rows.length;
}

/**
 * Runs one item's free rungs. Throws on failure so the caller can record why.
 *
 * `produced` is reported separately from success. Plenty of targets complete
 * perfectly and have nothing to cache — 23 of 31 states surfaced no readable
 * live scheme page on the first full pass, and a crop with no vegetable retail
 * listing yields no mandi roll-up. Counting those as "done" alongside the real
 * hits would hide exactly the coverage gap worth knowing about.
 */
async function warmOne(row: QueueRow): Promise<{ costUsd: number; produced: boolean }> {
  const budget = newBudget(WARM_MAX_USD);

  if (row.kind === "scheme") {
    const desk = await refreshSchemeDesk(row.target, { allowAgent: false, budget });
    return { costUsd: budget.spentUsd, produced: desk.liveCount > 0 };
  }

  if (row.kind === "mandi") {
    const [crop, state] = row.target.split(":");
    if (!crop || !state) throw new Error(`malformed mandi target "${row.target}"`);
    const report = await startLiveMandi(crop, state, {
      allowAgent: false,
      budget,
      // Unused while allowAgent is false: no run is started, so nothing is
      // owned. Passing a real id here would imply otherwise.
      ownerId: "",
    });
    return { costUsd: budget.spentUsd, produced: report.provenance !== "none" };
  }

  if (row.kind === "input") {
    const idx = row.target.indexOf(":");
    const category = row.target.slice(0, idx) as "fertiliser" | "seed" | "pesticide";
    const term = row.target.slice(idx + 1);
    if (!category || !term) throw new Error(`malformed input target "${row.target}"`);
    const report = await startInputPrices(
      { category, term },
      { allowAgent: false, budget, ownerId: "" }
    );
    return { costUsd: budget.spentUsd, produced: report.rows.length > 0 };
  }

  throw new Error(`unknown kind "${row.kind}"`);
}

async function run(req: Request): Promise<NextResponse> {
  const auth = checkCronAuth(req, "tinyfish warmer");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!anyKeyConfigured()) {
    // Not an error: an environment with no TinyFish key is a supported state,
    // and the app degrades to its built-ins. Saying so beats a silent no-op.
    return NextResponse.json({ ok: true, skipped: "no TinyFish key configured" });
  }

  const db = hazardAdmin();
  if (!db) return NextResponse.json({ error: "supabase service key missing" }, { status: 503 });

  const startedAt = Date.now();
  let seeded = 0;

  // Seeding is explicit, never automatic on an empty queue.
  //
  // The workflow calls this route repeatedly until `remaining` reaches zero.
  // If draining the queue re-filled it, that loop would never terminate — it
  // would warm the same 70-odd targets until the iteration cap stopped it.
  // So the workflow passes ?seed=1 on its first call of the night and never
  // again, and every later call only drains.
  if (new URL(req.url).searchParams.get("seed") === "1") {
    try {
      seeded = await seed(db);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: (e as Error).message },
        { status: 500 }
      );
    }
  }

  // Reclaim anything a previous, killed pass left claimed.
  await db
    .from("tf_warm_queue")
    .update({ status: "pending" })
    .eq("status", "running")
    .lt("ran_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

  let done = 0;
  let empty = 0;
  let failed = 0;
  let spentUsd = 0;

  /** Claims one pending row, or returns null when the queue is empty. */
  const claim = async (): Promise<QueueRow | null> => {
    const { data } = await db
      .from("tf_warm_queue")
      .select("id, kind, target, attempts")
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(1);

    const row = (data?.[0] as QueueRow | undefined) ?? null;
    if (!row) return null;

    // Claimed before the work starts, so a concurrent worker — in this pass or
    // another invocation — cannot pick up the same item and pay for it twice.
    // ran_at is stamped now so the stale-reclaim above has something to go on.
    const { data: won } = await db
      .from("tf_warm_queue")
      .update({
        status: "running",
        attempts: row.attempts + 1,
        ran_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");

    // Lost the race to another worker; try again rather than double-warming.
    if (!won?.length) return claim();
    return row;
  };

  const worker = async () => {
    while (Date.now() - startedAt < DEADLINE_MS) {
      const row = await claim();
      if (!row) return;

      try {
        const { costUsd, produced } = await warmOne(row);
        spentUsd += costUsd;
        if (produced) done += 1;
        else empty += 1;
        await db
          .from("tf_warm_queue")
          .update({
            status: "done",
            cost_usd: costUsd,
            ran_at: new Date().toISOString(),
            // Not an error — the target was read and had nothing to cache. Kept
            // so a coverage gap is inspectable instead of invisible.
            last_error: produced ? null : "completed with nothing to cache",
          })
          .eq("id", row.id);
      } catch (e) {
        failed += 1;
        const message = (e as Error)?.message?.slice(0, 300) ?? "failed";
        const retired = row.attempts + 1 >= MAX_ATTEMPTS;
        await db
          .from("tf_warm_queue")
          .update({
            status: retired ? "failed" : "pending",
            last_error: message,
            ran_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        console.warn(`tf/warm: ${row.kind}:${row.target} — ${message}${retired ? " (retired)" : ""}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const { count: remaining } = await db
    .from("tf_warm_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"]);

  return NextResponse.json({
    ok: true,
    seeded,
    done,
    empty,
    failed,
    remaining: remaining ?? 0,
    spentUsd: Number(spentUsd.toFixed(4)),
    ms: Date.now() - startedAt,
  });
}

// POST is the real entry point; GET mirrors it so the route can be checked
// from a browser or curl during setup, exactly as the hazard poller does.
export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}
