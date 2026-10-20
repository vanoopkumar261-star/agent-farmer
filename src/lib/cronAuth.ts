import { createHash, timingSafeEqual } from "crypto";

/**
 * Shared-secret authentication for scheduled routes.
 *
 * Extracted from src/app/api/cron/hazards/route.ts when a second scheduled
 * route (the TinyFish cache warmer) needed the same check. Two copies of a
 * comparison this easy to get subtly wrong is one copy too many.
 *
 * Why these jobs are HTTP routes with a secret rather than Vercel Cron: on the
 * Hobby plan Vercel Cron fires at most once a day, which cannot deliver a
 * two-hour thunderstorm warning. The schedule lives in GitHub Actions and
 * reaches the app over the network, so the endpoint has to defend itself.
 */

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws when the two buffers differ in length, and that
 * throw would itself leak the expected length, so both sides are hashed to a
 * fixed width first — cheaper than taking a dependency for one call.
 */
export function secretOk(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export type CronAuth =
  | { ok: true }
  /** 503 when unconfigured, 401 when the token is wrong. Never 200. */
  | { ok: false; status: 503 | 401; error: string };

/**
 * Checks the `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Fails closed on an unset secret. An unset secret must never mean "no
 * authentication required" — that would silently open the route the first time
 * someone deployed without the variable.
 */
export function checkCronAuth(req: Request, routeName: string): CronAuth {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error(`CRON_SECRET is not set — ${routeName} refused to run.`);
    return { ok: false, status: 503, error: "not configured" };
  }

  const header = req.headers.get("authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim() ?? null;
  if (!secretOk(token, expected)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
