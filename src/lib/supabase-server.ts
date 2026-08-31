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
export function bearerToken(): string | null {
  try {
    const raw = headers().get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
    return match?.[1]?.trim() || null;
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
 * Verifying the token is `getSessionUser()`'s job, in `auth.ts`; this function
 * only decides which identity the queries run as.
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
