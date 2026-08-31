import "server-only";
import { createSupabaseServer, bearerToken } from "./supabase-server";
import type { FarmerProfile } from "./dashboard";

/**
 * The authenticated Supabase auth user for this request, or null.
 *
 * Two transports resolve to the same identity: the web app's session cookie,
 * and the `Authorization: Bearer <jwt>` header the native app sends (it keeps
 * its session in AsyncStorage, not cookies). A Bearer token has to be handed to
 * `getUser(token)` explicitly — the no-argument form reads the cookie-backed
 * session store, which is empty on a mobile request.
 */
export async function getSessionUser() {
  const supabase = createSupabaseServer();
  const token = bearerToken();
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  return user;
}

/** The farmer profile owned by the signed-in user, or null if not onboarded. */
export async function getSessionFarmer(): Promise<FarmerProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  // createSupabaseServer() forwards the Bearer token to PostgREST, so this
  // owner-scoped read runs as the same user on either transport.
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as FarmerProfile) ?? null;
}
