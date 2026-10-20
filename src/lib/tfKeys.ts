import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The TinyFish key pool.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The hackathon grant is five API keys, each with its own quota. Until this
 * file, `tinyfish.ts` read one environment variable, so four fifths of the
 * grant was unreachable — not rate-limited, not budgeted away, simply never
 * addressed.
 *
 * A pool on serverless cannot keep its rotation state in a module variable:
 * every cold start begins again at zero and concurrent instances all choose the
 * same key. So selection is *least-spent-first*, read from `tf_key_ledger`.
 * That is self-correcting — a key that has been used converges away from being
 * picked — and it needs no coordination between instances.
 *
 * ── What a credit is ─────────────────────────────────────────────────────────
 *
 * Unknown, deliberately not guessed. `chargeKey` records agent steps, Search
 * queries and Fetch URLs separately, plus dollars at the one published rate
 * ($0.016/step). Whichever unit the grant turns out to be denominated in, the
 * number is already being counted. See the comment in 032_tf_key_ledger.sql.
 *
 * ── Degradation ──────────────────────────────────────────────────────────────
 *
 * Every database call here is wrapped. Before migration 032 is applied, or with
 * no service-role key, the pool falls back to in-process round-robin: worse
 * distribution, but the app keeps working. A missing ledger must never take
 * TinyFish down, exactly as a missing table never takes the store locator down
 * (src/lib/stores.ts).
 */

export type TfKey = {
  /** Position in TINYFISH_API_KEYS. Stable across restarts; persisted with runs. */
  index: number;
  /** 'key0 ****a3f1' — safe to log. Never contains usable key material. */
  label: string;
  secret: string;
};

export type TfKeyStatus = {
  index: number;
  label: string;
  agentSteps: number;
  searches: number;
  fetchUrls: number;
  spendUsd: number;
  lastError: string | null;
  disabledUntil: string | null;
};

/** How long a key is passed over after it reports no credits or a bad secret. */
const DISABLE_MINUTES = 360;

/** Ledger snapshots are reused this long, so picking a key is not a round trip per call. */
const SNAPSHOT_TTL_MS = 10_000;

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function labelFor(index: number, secret: string): string {
  return `key${index} ****${secret.slice(-4)}`;
}

/**
 * Parses the configured keys.
 *
 * `TINYFISH_API_KEYS` is the pool; `TINYFISH_API_KEY` stays supported as a
 * single-key fallback so an environment that has not been updated yet keeps
 * working rather than silently losing TinyFish entirely.
 *
 * Order matters and must stay stable: `index` is persisted against in-flight
 * runs, and a run id is only resolvable by the key that created it.
 */
export function loadKeys(): TfKey[] {
  const raw = process.env.TINYFISH_API_KEYS || process.env.TINYFISH_API_KEY || "";
  const seen = new Set<string>();
  const keys: TfKey[] = [];
  for (const part of raw.split(",")) {
    const secret = part.trim();
    if (!secret || seen.has(secret)) continue;
    seen.add(secret);
    keys.push({ index: keys.length, label: labelFor(keys.length, secret), secret });
  }
  return keys;
}

/** Whether TinyFish is configured at all. Replaces the old `!!process.env.TINYFISH_API_KEY`. */
export function anyKeyConfigured(): boolean {
  return loadKeys().length > 0;
}

/**
 * The key at a given pool position, for collecting a run started earlier.
 *
 * Polling must use the key that started the run — TinyFish resolves a run id
 * only for the account that owns it, so polling with a sibling key would 404 a
 * run that has already been paid for.
 */
export function keyByIndex(index: number): TfKey | null {
  return loadKeys().find((k) => k.index === index) ?? null;
}

type LedgerRow = {
  key_index: number;
  spend_usd: number;
  searches: number;
  fetch_urls: number;
  agent_steps: number;
  disabled_until: string | null;
};

let snapshot: { at: number; rows: Map<number, LedgerRow> } | null = null;
/** Only used when the ledger is unreachable; see the degradation note above. */
let fallbackCursor = 0;

/**
 * Picks handed out since the snapshot was taken, per key.
 *
 * The snapshot is deliberately reused for a few seconds so that choosing a key
 * is not a database round trip per call. Without this counter that caching
 * defeats the balancing: every pick inside the window reads identical totals
 * and returns the same key, so a burst — four concurrent warm workers, or the
 * three parallel searches behind one news request — all land together.
 *
 * Counting issued picks in process makes the window self-spreading. It is
 * per-instance and approximate, which is fine: the ledger is the real record
 * and corrects any drift at the next refresh.
 */
let issued = new Map<number, number>();

async function readLedger(): Promise<Map<number, LedgerRow> | null> {
  if (snapshot && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) return snapshot.rows;

  const db = admin();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from("tf_key_ledger")
      .select("key_index, spend_usd, searches, fetch_urls, agent_steps, disabled_until");
    if (error || !Array.isArray(data)) return null;

    const rows = new Map<number, LedgerRow>();
    for (const r of data as LedgerRow[]) rows.set(Number(r.key_index), r);
    snapshot = { at: Date.now(), rows };
    issued = new Map();
    return rows;
  } catch {
    return null;
  }
}

/**
 * The least-spent key that is not currently disabled.
 *
 * If every key is disabled we still return one — the least-spent of them —
 * rather than null. A `disabled_until` is our own inference from a previous
 * error, and the free tiers cost nothing to attempt; refusing to try would turn
 * a recoverable quota blip into a total outage of Search and Fetch. The call
 * will fail on its own if the key really is dead, and `disableKey` will push
 * its window out again.
 */
export async function pickKey(): Promise<TfKey | null> {
  const keys = loadKeys();
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];

  const rows = await readLedger();
  if (!rows) {
    const k = keys[fallbackCursor % keys.length];
    fallbackCursor += 1;
    return k;
  }

  const now = Date.now();

  /**
   * Total billable units asked of a key, counting every tier equally.
   *
   * Ranking on dollars alone does not work, and this was measured: a full warm
   * pass put all 117 searches and 308 fetch URLs on key0, because only agent
   * steps move `spend_usd`, so every key tied at $0.0000 and the index
   * tie-break won every time. The pool was single-key for free traffic — the
   * exact quota concentration it exists to prevent.
   *
   * Since nobody has told us what a "credit" is, the conservative assumption is
   * that every call consumes one, so free calls count here too.
   */
  const units = (k: TfKey) => {
    const r = rows.get(k.index);
    const recorded = r
      ? Number(r.searches ?? 0) + Number(r.fetch_urls ?? 0) + Number(r.agent_steps ?? 0)
      : 0;
    return recorded + (issued.get(k.index) ?? 0);
  };
  const spend = (k: TfKey) => Number(rows.get(k.index)?.spend_usd ?? 0);
  const disabled = (k: TfKey) => {
    const until = rows.get(k.index)?.disabled_until;
    return until ? Date.parse(until) > now : false;
  };

  // Units first so free traffic spreads; dollars second so paid work does not
  // pile onto one key either. Ties break on index, so concurrent instances
  // holding the same snapshot at least agree instead of scattering.
  const byLoad = (a: TfKey, b: TfKey) =>
    units(a) - units(b) || spend(a) - spend(b) || a.index - b.index;

  const live = keys.filter((k) => !disabled(k)).sort(byLoad);
  const chosen = live.length > 0 ? live[0] : null;
  if (chosen) {
    issued.set(chosen.index, (issued.get(chosen.index) ?? 0) + 1);
    return chosen;
  }

  console.warn("tf/keys: every key is disabled; trying the least-loaded one anyway");
  const fallback = [...keys].sort(byLoad)[0];
  issued.set(fallback.index, (issued.get(fallback.index) ?? 0) + 1);
  return fallback;
}

/**
 * Record what a key was asked to do.
 *
 * Goes through the `tf_charge_key` SQL function rather than a read-modify-write
 * so two invocations charging the same key concurrently cannot lose a count.
 * Never throws and never blocks the caller's result: an uncounted call is a
 * reporting gap, while a thrown error here would discard work already paid for.
 */
export async function chargeKey(
  key: TfKey,
  usage: { steps?: number; searches?: number; fetchUrls?: number }
): Promise<void> {
  const steps = Math.max(0, Math.trunc(usage.steps ?? 0));
  const searches = Math.max(0, Math.trunc(usage.searches ?? 0));
  const fetchUrls = Math.max(0, Math.trunc(usage.fetchUrls ?? 0));
  if (!steps && !searches && !fetchUrls) return;

  const db = admin();
  if (!db) return;
  try {
    await db.rpc("tf_charge_key", {
      p_key_index: key.index,
      p_label: key.label,
      p_steps: steps,
      p_searches: searches,
      p_fetch_urls: fetchUrls,
      // The only rate we have been told. Free tiers contribute 0 here but are
      // still counted in their own columns.
      p_usd: steps * 0.016,
    });
    // The snapshot just went stale by exactly this charge; the in-process
    // issued counter goes with it, or those picks would be counted twice.
    snapshot = null;
    issued = new Map();
  } catch {
    /* reporting gap, not a failure */
  }
}

/**
 * Pass over a key for a while, and say why.
 *
 * Called on 402 INSUFFICIENT_CREDITS and 401 INVALID_API_KEY. The window is
 * hours rather than forever because a quota can reset and a key wrongly retired
 * would shrink the pool with nothing on screen to explain it. `last_error`
 * survives re-enabling so a repeatedly failing key stays visible.
 */
export async function disableKey(key: TfKey, reason: string): Promise<void> {
  const until = new Date(Date.now() + DISABLE_MINUTES * 60_000).toISOString();
  console.warn(`tf/keys: ${key.label} disabled until ${until} — ${reason}`);

  const db = admin();
  if (!db) return;
  try {
    await db
      .from("tf_key_ledger")
      .upsert(
        {
          key_index: key.index,
          label: key.label,
          last_error: reason.slice(0, 300),
          disabled_until: until,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key_index" }
      );
    snapshot = null;
  } catch {
    /* the in-process pool still works; the next instance just will not know */
  }
}

/**
 * The next key to try after one failed with "no run was started".
 *
 * Returns null when there is nothing else to try, which the caller surfaces as
 * an ordinary budget failure rather than inventing a retry loop.
 */
export async function nextKeyAfter(failed: TfKey): Promise<TfKey | null> {
  const keys = loadKeys();
  if (keys.length < 2) return null;
  await disableKey(failed, "no-credit / invalid key");
  const next = await pickKey();
  return next && next.index !== failed.index ? next : null;
}

/** Operator view. Returns no key material, by construction. */
export async function tfKeyStatus(): Promise<TfKeyStatus[]> {
  const keys = loadKeys();
  const db = admin();
  const rows = new Map<number, Record<string, unknown>>();

  if (db) {
    try {
      const { data } = await db.from("tf_key_ledger").select("*");
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        rows.set(Number(r.key_index), r);
      }
    } catch {
      /* fall through to zeros */
    }
  }

  return keys.map((k) => {
    const r = rows.get(k.index);
    return {
      index: k.index,
      label: k.label,
      agentSteps: Number(r?.agent_steps ?? 0),
      searches: Number(r?.searches ?? 0),
      fetchUrls: Number(r?.fetch_urls ?? 0),
      spendUsd: Number(r?.spend_usd ?? 0),
      lastError: (r?.last_error as string) ?? null,
      disabledUntil: (r?.disabled_until as string) ?? null,
    };
  });
}
