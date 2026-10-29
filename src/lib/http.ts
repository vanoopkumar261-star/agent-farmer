import { groqKeyPool } from "./groqKeys";

/**
 * fetch with a bounded retry, for calls to third-party APIs.
 *
 * Why this exists: outbound HTTPS to api.groq.com fails intermittently on this
 * machine with UNABLE_TO_VERIFY_LEAF_SIGNATURE. The certificate itself is fine
 * — probing the endpoint shows a genuine Google Trust Services chain
 * (api.groq.com → WE1 → GTS Root R4) validating against Node's default CA
 * store. The failure is that the CDN sometimes serves an *incomplete* chain,
 * omitting an intermediate. Browsers and curl recover by fetching the missing
 * certificate from the AIA extension; Node deliberately does not implement AIA
 * chasing, so the same request that works in a browser throws here, and it
 * throws for maybe one connection in three.
 *
 * Nothing in the app can fix that — it is a property of the remote server and
 * of Node's TLS stack. What the app can do is not turn a one-in-three transport
 * blip into a user-visible failure, which is what a retry buys.
 *
 * What is retried, and why it is safe to retry it:
 *
 *   · fetch threw          the request never reached the server, so replaying it
 *                          cannot duplicate any effect. This is the TLS case.
 *   · 408 / 425 / 429      the server explicitly declined to act on it.
 *   · 500 / 502 / 503 / 504  the upstream failed. Every caller here is a
 *                          stateless completion or transcription request, so a
 *                          repeat costs tokens and nothing else.
 *
 * A 4xx other than the above is the request being wrong, and repeating it just
 * makes the same mistake more slowly — those return immediately.
 */

/**
 * The Groq text model every feature uses.
 *
 * Kept in one place with an env override because Groq retires models without
 * warning, and the failure is total: on 2026-08-17 `llama-3.1-8b-instant`
 * started returning 404 "model does not exist", which broke the assistant, crop
 * recommendations, scheme matching, market advice, the crop guide and the
 * disease narrative simultaneously. Recovering meant editing six files.
 * Changing it is now one environment variable, with no redeploy of code.
 *
 * If the assistant starts failing, check https://console.groq.com/docs/models
 * and set GROQ_TEXT_MODEL to a current id.
 *
 * Two models on the current list are traps and were rejected after testing:
 * `openai/gpt-oss-20b` returns an EMPTY `content` string and puts its answer in
 * a separate `reasoning` field, and the `qwen/qwen3.x-27b` models leak `<think>` blocks
 * into the reply. `gpt-oss-120b` returns clean prose, supports JSON mode and
 * streaming, and answers correctly in Indic scripts.
 */
export const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * What to say when Groq returns 429 — which is two completely different
 * situations wearing one status code.
 *
 * "Please wait a moment and try again" was the only answer, and on a
 * tokens-per-DAY exhaustion it is simply false: the on-demand tier allows
 * 200,000 tokens a day for a model, the window is rolling, and Groq's own
 * reply says how long — typically ten to fifteen minutes before enough old
 * tokens age out, not "a moment". A farmer told to try again immediately does,
 * gets refused again, and concludes the app is broken.
 *
 * So the upstream detail is read rather than discarded. Groq phrases it as
 * "on tokens per day (TPD): Limit 200000, Used 198115 ... Please try again in
 * 12m38.16s", and both the kind of limit and the wait are worth repeating
 * back verbatim-ish: they are the difference between "retry now" and "this is
 * done until the budget recovers".
 */
export function rateLimitMessage(detail: string): string {
  const perDay = /tokens per day|\bTPD\b/i.test(detail);
  const wait = detail.match(/try again in (\d+)m/i)?.[1];

  if (perDay) {
    return wait
      ? `The AI engine has used up today's token budget. It should start working again in about ${wait} minutes.`
      : "The AI engine has used up today's token budget. It will recover shortly, but heavy testing will hit this again.";
  }
  return wait
    ? `The AI engine is busy. Please try again in about ${wait} minutes.`
    : "The AI engine is rate-limited right now. Please wait a moment and try again.";
}

/**
 * Reads a Groq chat-completion response, or throws something that says why not.
 *
 * The trap this exists to close: a rejected Groq request still returns valid
 * JSON, but it carries `{ error: { message, code } }` and no `choices` array.
 * Code that reaches straight for `data.choices[0].message.content` therefore
 * turns *every* failure — a bad key, a rate limit, a retired model — into the
 * same "empty response", which names the one thing that is not the problem and
 * hides the one detail needed to fix it. That is exactly how a missing
 * GROQ_API_KEY on a deployment presented itself.
 *
 * Returns the assistant's message content. Throws with the real reason
 * otherwise, and logs the upstream detail for the server logs.
 */
export async function readGroqContent(res: Response, label: string): Promise<string> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? JSON.stringify(body).slice(0, 300);
    } catch {
      detail = (await res.text().catch(() => "")).slice(0, 300);
    }
    console.error(`${label} failed:`, res.status, detail);

    if (res.status === 401)
      throw new Error(
        "The AI engine rejected our credentials (401). Check GROQ_API_KEY in the deployment's environment variables."
      );
    if (res.status === 429) throw new Error(rateLimitMessage(detail));
    if (res.status === 404) throw new Error(`The AI model is unavailable (404): ${detail}`);
    throw new Error(`The AI engine returned ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) {
    console.error(`${label}: HTTP 200 but no content:`, JSON.stringify(data).slice(0, 400));
    throw new Error("The AI engine returned no content. Please try again.");
  }
  return raw as string;
}

export type RetryOptions = {
  /** Additional attempts after the first. Default 2, so 3 tries at most. */
  retries?: number;
  /** Base backoff in ms; doubles each attempt. Default 400. */
  backoffMs?: number;
  /** Label for the log line, so a flaky endpoint is identifiable. */
  label?: string;
  /**
   * Which statuses to retry on THIS key. Defaults to RETRY_STATUS. groqFetch
   * passes a set WITHOUT 429/401 so those bubble up at once and it can fail
   * over to the next key instead of burning retries on a spent one.
   */
  retryStatus?: Set<number>;
};

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  { retries = 2, backoffMs = 400, label = "upstream", retryStatus = RETRY_STATUS }: RetryOptions = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = backoffMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }

    try {
      const res = await fetch(input, init);

      if (!retryStatus.has(res.status) || attempt === retries) return res;

      console.warn(`${label}: HTTP ${res.status}, retrying (attempt ${attempt + 1}/${retries + 1})`);
      // The body is never read on a retried response; dropping it lets the
      // connection be reused rather than left half-consumed.
      await res.body?.cancel().catch(() => {});
    } catch (e) {
      lastError = e;
      const code = (e as { cause?: { code?: string } })?.cause?.code ?? "";

      // An abort is the caller's own timeout firing. Retrying would quietly
      // multiply a deadline the caller deliberately set.
      if ((e as Error)?.name === "AbortError" || (e as Error)?.name === "TimeoutError") throw e;

      if (attempt === retries) break;
      console.warn(
        `${label}: ${code || (e as Error)?.message}, retrying (attempt ${attempt + 1}/${retries + 1})`
      );
    }
  }

  throw lastError;
}

/** Statuses groqFetch retries on the SAME key (TLS/5xx), i.e. not 429/401 — those
 *  fail over to the next key instead. */
const GROQ_SAME_KEY_RETRY = new Set([408, 425, 500, 502, 503, 504]);

function withAuthKey(init: RequestInit | undefined, key: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${key}`);
  return { ...init, headers };
}

/**
 * fetchWithRetry for Groq, with KEY-POOL failover.
 *
 * The caller no longer sets the Authorization header: groqFetch supplies it from
 * the key pool (src/lib/groqKeys.ts). Transient failures (TLS blip, 5xx) are
 * retried on the same key by fetchWithRetry; a 429 (rate limited) or 401 (bad
 * key) instead fails the request straight over to the NEXT key, so a spent org
 * budget no longer reaches the farmer while another key still has headroom.
 * When every key is spent it returns the last 429 so the caller's own 429
 * handling (rateLimitMessage) still runs.
 *
 * With a single key configured it behaves exactly like fetchWithRetry (same
 * retries, same 429 handling), so nothing regresses on a one-key deployment.
 */
export async function groqFetch(
  input: string,
  init?: RequestInit,
  opts: RetryOptions = {}
): Promise<Response> {
  const keys = groqKeyPool();
  const label = opts.label ?? "groq";

  if (keys.length <= 1) {
    const only = keys[0];
    return fetchWithRetry(input, only ? withAuthKey(init, only) : init, opts);
  }

  let lastRes: Response | null = null;
  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetchWithRetry(input, withAuthKey(init, keys[i]), {
        ...opts,
        label: `${label} (key ${i + 1}/${keys.length})`,
        retryStatus: GROQ_SAME_KEY_RETRY,
      });
      if (res.status !== 429 && res.status !== 401) return res;
      await res.body?.cancel().catch(() => {});
      lastRes = res;
      console.warn(`${label}: key ${i + 1}/${keys.length} returned ${res.status}; failing over`);
    } catch (e) {
      lastErr = e;
      console.warn(`${label}: key ${i + 1}/${keys.length} threw; failing over`);
    }
  }
  if (lastRes) return lastRes;
  throw lastErr;
}
