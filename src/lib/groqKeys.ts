/**
 * The Groq API key pool.
 *
 * One Groq org shares an 8,000 tokens/MINUTE ceiling across every request this
 * app makes (see rateLimitMessage in src/lib/http.ts) — the real cause of the
 * "rate limited" a Premium farmer could still hit. Rotating across several keys
 * from separate orgs multiplies the effective ceiling, and, more importantly,
 * lets a request that lands on a rate-limited key fail over to a fresh one
 * rather than failing the farmer.
 *
 * Keys are SERVER secrets: GROQ_API_KEY and the optional GROQ_API_KEY_2 /
 * GROQ_API_KEY_3 live in the deployment environment only. They are never
 * EXPO_PUBLIC_*, and never reach the mobile app — the app calls our routes,
 * which hold the keys.
 */

// Module-level cursor so load spreads across keys over the process's lifetime.
let cursor = 0;

/** Every configured key, in order, trimmed and de-blanked. */
export function groqKeyPool(): string[] {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3]
    .map((k) => k?.trim())
    .filter((k): k is string => !!k);
}

/** The next key by round-robin, or undefined if none is configured. */
export function nextGroqKey(): string | undefined {
  const keys = groqKeyPool();
  if (keys.length === 0) return undefined;
  const key = keys[cursor % keys.length];
  cursor = (cursor + 1) % keys.length;
  return key;
}
