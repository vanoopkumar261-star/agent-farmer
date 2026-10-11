/**
 * A timed, retrying fetch — the harness's own copy of src/lib/http.ts's
 * fetchWithRetry, because that module cannot be imported here (24 files under
 * src/lib open with `import "server-only"` and use @/ aliases only Next's
 * compiler resolves).
 *
 * The retry is not optional politeness. api.groq.com on this machine serves an
 * incomplete certificate chain on roughly one connection in three, and Node
 * does not do AIA chasing, so the request throws UNABLE_TO_VERIFY_LEAF_SIGNATURE
 * even though the certificate is fine. Without this the harness would report a
 * Groq outage that is not one — which is the single most likely way for a
 * verification tool to lie to you.
 *
 * `attempts` is returned rather than swallowed: a probe that passed on the
 * third try is a different fact from one that passed on the first, and the
 * report says so.
 */

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @returns {Promise<{res: Response|null, ms: number, attempts: number, error: Error|null, tls: number}>}
 *   `tls` counts how many attempts died on the incomplete-chain error, so the
 *   flap rate can be reported as evidence rather than mistaken for downtime.
 */
export async function fetchRetry(url, init = {}, opts = {}) {
  const { retries = 2, backoffMs = 400, timeoutMs = 30_000, retryOn429 = true } = opts;
  const started = Date.now();
  let attempts = 0;
  let tls = 0;
  let lastError = null;

  for (let i = 0; i <= retries; i++) {
    if (i > 0) await sleep(backoffMs * 2 ** (i - 1));
    attempts++;
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 && !retryOn429) {
        return { res, ms: Date.now() - started, attempts, error: null, tls };
      }
      if (!RETRY_STATUS.has(res.status) || i === retries) {
        return { res, ms: Date.now() - started, attempts, error: null, tls };
      }
      // Drop the body so the connection can be reused rather than left half read.
      await res.body?.cancel().catch(() => {});
    } catch (e) {
      lastError = e;
      const code = e?.cause?.code ?? "";
      if (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") tls++;
      // A caller's own deadline firing is not something to multiply.
      if (e?.name === "AbortError" || e?.name === "TimeoutError") break;
      if (i === retries) break;
    }
  }

  return { res: null, ms: Date.now() - started, attempts, error: lastError, tls };
}

/** Reads a response as JSON, or returns the raw text when it is not JSON. */
export async function readBody(res) {
  const text = await res.text().catch(() => "");
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

/** Trims anything long enough to bloat a report, preserving the head. */
export function clip(value, max = 600) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (s === undefined) return "";
  return s.length > max ? `${s.slice(0, max)}… (${s.length} chars)` : s;
}
