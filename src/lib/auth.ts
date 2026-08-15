import "server-only";
import { createSupabaseServer } from "./supabase-server";
import type { FarmerProfile } from "./dashboard";

/** The authenticated Supabase auth user for this request, or null. */
export async function getSessionUser() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The farmer profile owned by the signed-in user, or null if not onboarded. */
export async function getSessionFarmer(): Promise<FarmerProfile | null> {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as FarmerProfile) ?? null;
}
