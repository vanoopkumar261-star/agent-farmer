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

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export type RetryOptions = {
  /** Additional attempts after the first. Default 2, so 3 tries at most. */
  retries?: number;
  /** Base backoff in ms; doubles each attempt. Default 400. */
  backoffMs?: number;
  /** Label for the log line, so a flaky endpoint is identifiable. */
  label?: string;
};

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  { retries = 2, backoffMs = 400, label = "upstream" }: RetryOptions = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = backoffMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }

    try {
      const res = await fetch(input, init);

      if (!RETRY_STATUS.has(res.status) || attempt === retries) return res;

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
