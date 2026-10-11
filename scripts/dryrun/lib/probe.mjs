/**
 * The probe record, and the status vocabulary the whole report is built on.
 *
 * Pass/fail is the wrong language for this codebase. src/lib/inference.ts says
 * it outright: "absent is a normal state, not a fault." Several integrations
 * are *designed* to be missing here — no INFERENCE_URL, no RESEND_API_KEY, no
 * GOOGLE_MAPS_API_KEY — and a harness that paints those red teaches you to stop
 * reading it.
 *
 * So a probe declares up front which statuses count as success for *it*. The
 * same word means opposite things in two places, and that is the point:
 *
 *   /api/tts   expects ["absent"]  — a 503 with no ml server is correct
 *   /api/market expects ["live"]   — `isRealData: false` means the key broke
 *
 * `evidence` is always the observed value, never a boolean. The report is
 * readable precisely because it quotes what came back.
 */

export const STATUS = {
  LIVE: "live", // real upstream, real data
  CACHED: "cached", // correct, served from a store rather than the wire
  FALLBACK: "fallback", // the designed degraded path ran
  ABSENT: "absent", // intentionally not configured, and it said so cleanly
  DEGRADED: "degraded", // reachable but wrong, thin, or slow
  FAIL: "fail", // configured and broken, or a security assertion violated
  SKIP: "skip", // a precondition was unmet — no information either way
  ERROR: "error", // the probe itself threw; a harness bug, not a finding
};

/** Statuses that make the run exit non-zero. */
const BAD = new Set([STATUS.FAIL, STATUS.ERROR]);

export function isBad(status) {
  return BAD.has(status);
}

/**
 * Was this the outcome the probe said it expected?
 * A probe that expected `absent` and got `live` is not a failure — it is a
 * pleasant surprise, and the report labels it that way rather than hiding it.
 */
export function meetsExpectation(record) {
  if (!record.expected?.length) return !isBad(record.status);
  if (record.expected.includes(record.status)) return true;
  return false;
}

let counter = 0;

/**
 * Wraps a probe body so a thrown exception becomes an `error` record rather
 * than killing the run. One broken probe must never cost you the other forty.
 */
export async function runProbe({ id, layer, title, expected = [STATUS.LIVE] }, body) {
  const started = Date.now();
  const seq = ++counter;
  try {
    const out = await body();
    return {
      seq,
      id,
      layer,
      title,
      expected,
      status: out.status,
      ms: out.ms ?? Date.now() - started,
      attempts: out.attempts ?? 1,
      evidence: out.evidence ?? null,
      verdict: out.verdict ?? "",
      error: null,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      seq,
      id,
      layer,
      title,
      expected,
      status: STATUS.ERROR,
      ms: Date.now() - started,
      attempts: 1,
      evidence: null,
      verdict: `probe threw: ${e?.message ?? e}`,
      error: String(e?.stack ?? e),
      at: new Date().toISOString(),
    };
  }
}

/**
 * Attributes a 429 to whoever actually issued it. Three different owners, three
 * different meanings, and conflating them turns a pacing bug in the harness
 * into a phantom outage in the report.
 *
 *   ours        → the harness outran our own limiter. A harness bug. `fail`.
 *   groq        → back off once, then stop asking. `skip`.
 *   thirdParty  → the daily quota is spent; the key is fine. `fallback`.
 */
export function classify429(res, text) {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter && /faster than we can answer|rate limit/i.test(text)) {
    return { owner: "ours", retryAfter, status: STATUS.FAIL };
  }
  if (/api\.groq\.com/.test(res.url ?? "")) {
    return { owner: "groq", retryAfter, status: STATUS.SKIP };
  }
  return { owner: "thirdParty", retryAfter, status: STATUS.FALLBACK };
}
