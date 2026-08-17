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
 * a separate `reasoning` field, and `qwen/qwen3.6-27b` leaks `<think>` blocks
 * into the reply. `gpt-oss-120b` returns clean prose, supports JSON mode and
 * streaming, and answers correctly in Indic scripts.
 */
export const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

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
    if (res.status === 429)
      throw new Error("The AI engine is rate-limited right now. Please wait a moment and try again.");
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
