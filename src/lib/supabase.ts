import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for client components. Backed by cookies (via
 * `@supabase/ssr`) so the auth session is shared with the server — the same
 * cookie the middleware and the server client read.
 *
 * Constructed lazily, on first use, behind a Proxy.
 *
 * The reason is a build failure rather than a preference. `createBrowserClient`
 * throws immediately when the URL or key is missing, and this module used to
 * call it at import time. `/oilseeds` and `/onboarding` are statically
 * prerendered, and prerendering imports their module graph — so on any machine
 * without `NEXT_PUBLIC_SUPABASE_*` in the environment, `next build` failed
 * during static export with a Supabase configuration error. On Vercel that
 * means the deployment fails and the previous version keeps serving, which
 * looks exactly like "my fix did not deploy".
 *
 * Deferring construction means the build never needs the credentials — only a
 * real browser session does, which is the only place this client is usable
 * anyway. The keys are still required at runtime; they now fail loudly at the
 * point of use, naming what is missing, instead of silently breaking a build.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment (and in the Vercel " +
        "project settings for a deployment)."
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}

/**
 * Kept as a `supabase` binding so every existing `supabase.from(...)` and
 * `supabase.auth.*` call site works unchanged — the Proxy forwards property
 * access to the real client and builds it on the first one.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    // Methods must stay bound to the client, not to the Proxy.
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
