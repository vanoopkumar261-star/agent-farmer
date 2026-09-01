import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * The `Authorization: Bearer <jwt>` token on this request, or null.
 *
 * The web app authenticates with a session cookie, but the native app
 * (`agent-farmer-mobile`, its own repo) has no cookie jar — it holds a Supabase
 * session in AsyncStorage and sends the access token as a Bearer header. Both
 * are the same Supabase project and the same accounts; only the transport
 * differs.
 */
/**
 * True if a JWT's payload looks like an end-user access token.
 *
 * This is a claim *shape* check, not authentication — the payload is read
 * without verifying the signature, so it may only ever be used to decide
 * whether a token is worth forwarding. Proving the token is genuine is
 * `getSessionUser()`'s job in `auth.ts`, which round-trips it to GoTrue.
 *
 * The check that matters is `role`. A Supabase project's `service_role` key is
 * itself a JWT, and PostgREST honours it in an Authorization header by
 * bypassing RLS entirely. Forwarded blindly, a service-role key presented by a
 * caller — a misconfigured mobile build, a leaked CI variable, a proxy that
 * injects one — would read every farmer's rows, while `getUser()` rejects it
 * ("missing sub claim") so the application layer simultaneously believes nobody
 * is signed in. Anything that is not a plain authenticated user token is
 * dropped here rather than handed to the database.
 */
function isUserToken(jwt: string): boolean {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return false;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    const claims = JSON.parse(json) as { sub?: unknown; role?: unknown };
    return typeof claims.sub === "string" && claims.sub.length > 0 && claims.role === "authenticated";
  } catch {
    return false;
  }
}

export function bearerToken(): string | null {
  try {
    const raw = headers().get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
    const token = match?.[1]?.trim();
    if (!token) return null;
    return isUserToken(token) ? token : null;
  } catch {
    // headers() is unavailable outside a request scope (e.g. static rendering).
    return null;
  }
}

/**
 * Cookie-aware Supabase client for server components and route handlers.
 * Reads the auth session from the request cookies so RLS runs as the signed-in
 * farmer (auth.uid()). Create one per request — never cache the instance.
 *
 * When the request carries a Bearer token instead of cookies, it is forwarded
 * to PostgREST/Storage as the Authorization header so owner-scoped RLS (see
 * `scripts/sql/015_reapply_owner_rls.sql`) resolves to that same farmer. This
 * is what lets the mobile app read and write its own rows through these routes.
 * Only a token whose claims say `role: "authenticated"` is forwarded — see
 * `isUserToken()` above for why a service-role key must never reach PostgREST
 * this way. Verifying that the token is *genuine* remains `getSessionUser()`'s
 * job, in `auth.ts`; this function only decides which identity the queries run
 * as.
 *
 * Browsers never set Authorization on same-origin calls to our own routes, so
 * the cookie path is unaffected.
 */
export function createSupabaseServer() {
  const cookieStore = cookies();
  const token = bearerToken();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The middleware refreshes the session cookie, so this is safe to ignore.
          }
        },
      },
    }
  );
}
