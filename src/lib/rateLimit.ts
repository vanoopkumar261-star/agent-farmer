import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSessionFarmer } from "@/lib/auth";

/**
 * Fixed-window rate limiting for the AI endpoints.
 *
 * Five of them take no authentication — recommendations, crop-guide,
 * market-advice, scheme-match and chat — and every call spends Groq tokens, so
 * without this anyone holding a URL can drain the project's quota from a shell
 * loop. Authenticated endpoints are limited too: a valid session is not a
 * licence to run the bill up.
 *
 * Fixed windows rather than a sliding log: a sliding window needs a row per
 * request, and the whole point is to keep the cost of counting far below the
 * cost of the call being counted. The trade-off is that a caller can spend two
 * windows' budget across a window boundary — irrelevant at these limits.
 *
 * State lives in Postgres because the app runs as serverless functions. Each
 * instance has its own memory, so an in-memory counter would limit one instance
 * and leave the rest untouched.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the current window closes. For the Retry-After header. */
  retryAfter: number;
  /** Requests left in this window; 0 once exceeded. */
  remaining: number;
};

/** Per-endpoint budgets. Tightest where a single call is most expensive. */
export const LIMITS = {
  chat: { limit: 20, windowSec: 60 },
  disease: { limit: 10, windowSec: 60 },
  recommendations: { limit: 10, windowSec: 60 },
  "crop-guide": { limit: 20, windowSec: 60 },
  "market-advice": { limit: 20, windowSec: 60 },
  "scheme-match": { limit: 20, windowSec: 60 },
  transcribe: { limit: 30, windowSec: 60 },
  tts: { limit: 30, windowSec: 60 },
  feedback: { limit: 5, windowSec: 60 },
} as const;

export type Endpoint = keyof typeof LIMITS;

/**
 * Identifies the caller: the signed-in farmer if there is one, else their IP.
 *
 * The farmer id is read from the session cookie server-side and never from the
 * request body — a client that could name its own bucket could simply pick a
 * fresh one per request and never be limited.
 */
async function callerKey(req: Request): Promise<string> {
  try {
    const farmer = await getSessionFarmer();
    if (farmer?.id) return `u:${farmer.id}`;
  } catch {
    /* Signed out, or the profile lookup failed — fall through to the IP. */
  }

  // x-forwarded-for is a client-supplied header in general, but on Vercel the
  // proxy overwrites it, and its first entry is the real client address.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/**
 * Counts one request against `endpoint`'s budget.
 *
 * **Fails open.** If the database is unreachable the request is allowed: a
 * limiter that takes the whole app down whenever Postgres hiccups causes more
 * harm than the abuse it exists to prevent. The failure is logged so it is
 * visible rather than silent.
 */
export async function checkRateLimit(req: Request, endpoint: Endpoint): Promise<RateLimitResult> {
  const { limit, windowSec } = LIMITS[endpoint];

  const allow = (remaining: number): RateLimitResult => ({ ok: true, retryAfter: 0, remaining });

  if (!url || !serviceKey) {
    console.warn("rateLimit: Supabase service env missing — not limiting");
    return allow(limit);
  }

  // Snap to the start of the current window so every instance agrees on which
  // bucket a request belongs to without coordinating.
  const nowMs = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const retryAfter = Math.ceil((windowStart.getTime() + windowMs - nowMs) / 1000);

  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const key = `${endpoint}:${await callerKey(req)}`;

    const { data, error } = await admin.rpc("bump_rate_limit", {
      p_key: key,
      p_window: windowStart.toISOString(),
      p_limit: limit,
    });

    if (error) {
      console.error("rateLimit: bump failed, allowing:", error.message);
      return allow(limit);
    }

    const hits = typeof data === "number" ? data : Number(data ?? 0);

    // Sweep expired windows occasionally rather than on every request — the
    // table is write-heavy and this only needs to happen often enough to stop
    // it growing without bound.
    if (Math.random() < 0.02) {
      void admin
        .from("api_rate_limits")
        .delete()
        .lt("window_start", new Date(nowMs - 60 * 60 * 1000).toISOString())
        .then(undefined, () => {});
    }

    if (hits > limit) return { ok: false, retryAfter, remaining: 0 };
    return { ok: true, retryAfter, remaining: Math.max(0, limit - hits) };
  } catch (e) {
    console.error("rateLimit: unavailable, allowing:", e);
    return allow(limit);
  }
}

/** The 429 every limited route returns, so the wording and headers stay identical. */
export function rateLimited(result: RateLimitResult): Response {
  return new Response(
    `You're sending requests faster than we can answer them. Please wait ${result.retryAfter} second${
      result.retryAfter === 1 ? "" : "s"
    } and try again.`,
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}
