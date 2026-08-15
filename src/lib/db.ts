import { supabase } from "./supabase";
import { estimateYieldLabel, suggestHarvestDate } from "./agronomy";

export async function createFarmerProfile(profile: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create a profile.");

  // The farmer's answer on the oilseed awareness page, when they passed through
  // it. Kept in the existing preferences jsonb — no schema change needed.
  const prefsPatch =
    typeof profile.oilseedAck === "boolean"
      ? { oilseed_ack: profile.oilseedAck, oilseed_ack_at: new Date().toISOString() }
      : null;

  // One profile per account. If onboarding runs again (e.g. "add a farm"),
  // reuse the existing profile instead of creating a duplicate farmer.
  const { data: existing } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    // Returning farmer — refresh their acknowledgement if they answered again.
    if (!prefsPatch) return existing;
    const { data: updated, error: updateError } = await supabase
      .from("farmer_profiles")
      .update({ preferences: { ...(existing.preferences ?? {}), ...prefsPatch } })
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError) { console.error("SUPABASE ERROR:", updateError); return existing; }
    return updated;
  }

  const { data, error } = await supabase
    .from("farmer_profiles")
    .insert([{
      owner_id: user.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email || user.email,
      house_lat: profile.location?.lat,
      house_lng: profile.location?.lng,
      house_address: profile.locationAddress,
      preferences: prefsPatch ?? {}
    }])
    .select()
    .single();

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
  return data;
}

export async function createFarms(farmerId: string, farms: any[]) {
  // Continue numbering from the farmer's existing farms. Onboarding can run
  // again via "+ Add farm", and numbering each batch from 1 would give every
  // run a "Farm 1" — colliding labels across the dashboard and, worse,
  // colliding task keys.
  const { data: existing } = await supabase
    .from("farms")
    .select("farm_index")
    .eq("farmer_id", farmerId)
    .order("farm_index", { ascending: false })
    .limit(1);

  const startIndex = (existing?.[0]?.farm_index ?? 0) + 1;

  const { data, error } = await supabase
    .from("farms")
    .insert(
      farms.map((f, idx) => ({
        farmer_id: farmerId,
        farm_index: startIndex + idx,
        area: f.area,
        soil_type: f.soilType,
        irrigation: f.irrigation
      }))
    )
    .select();

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
  return data;
}

/**
 * Updates one crop cycle's harvest date from the dashboard.
 *
 * Pass a yyyy-mm-dd string to set the farmer's own date, or null to clear it and
 * fall back to the agronomy engine's estimate. Returns false (rather than
 * throwing) when the write fails — e.g. before migration 009 has been applied —
 * so the caller can surface a message without breaking the page.
 */
export async function updateEstimatedHarvestDate(
  cropCycleId: string,
  date: string | null
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("crop_cycles")
      .update({ estimated_harvest_date: date })
      .eq("id", cropCycleId);
    if (error) console.error("SUPABASE ERROR:", error);
    return !error;
  } catch (e) {
    console.error("SUPABASE ERROR:", e);
    return false;
  }
}

/**
 * Removes one farm and everything hanging off it.
 *
 * Onboarding only ever appended farms and nothing could remove one, so a few
 * runs through onboarding left an account with farms it never meant to keep and
 * no way to clear them. This is that missing half.
 *
 * The database does the cascading: `crop_cycles` and `farm_tasks` are ON DELETE
 * CASCADE, while `crop_health_records.farm_id` is ON DELETE SET NULL — disease
 * scans are a record of something that really happened, so they survive the
 * farm and simply stop pointing at it.
 *
 * RLS scopes the delete to the signed-in owner, so a wrong id deletes nothing
 * rather than someone else's farm. Returns false instead of throwing so the
 * caller can show a message without taking the page down.
 */
export async function deleteFarm(farmId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("farms").delete().eq("id", farmId);
    if (error) console.error("SUPABASE ERROR:", error);
    return !error;
  } catch (e) {
    console.error("SUPABASE ERROR:", e);
    return false;
  }
}

export async function createCropCycles(farmsInserted: any[], selections: any[]) {
  const inserts = farmsInserted.map((farm, idx) => {
    const sel = selections[idx];
    // A typed custom crop overrides the AI selection (matches the UI's rule).
    const crop = (sel.customCrop?.trim() || sel.chosenCrop || "").trim();
    const area = Number(farm.area) || 0;
    // The farmer's own harvest date, per farm. Falls back to the agronomy
    // estimate so the dashboard countdown always has a date to work with.
    const harvestDate =
      sel.estimatedHarvestDate?.trim() ||
      (crop && sel.seedingDate ? suggestHarvestDate(crop, sel.seedingDate) : "") ||
      null;
    return {
      farm_id: farm.id,
      chosen_crop: crop,
      seeding_date: sel.seedingDate,
      estimated_harvest_date: harvestDate,
      expected_yield: crop ? estimateYieldLabel(crop, area) : null,
    };
  });

  const { error } = await supabase
    .from("crop_cycles")
    .insert(inserts);

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
}