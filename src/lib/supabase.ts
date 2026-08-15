import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client for client components. Backed by cookies (via
 * @supabase/ssr) so the auth session is shared with the server — the same
 * cookie the middleware and server client read. Keep the `supabase` export
 * name so existing client-component imports keep working.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
