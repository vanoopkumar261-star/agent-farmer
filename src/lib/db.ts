import { supabase } from "./supabase";

export async function createFarmerProfile(profile: any) {
  const { data, error } = await supabase
    .from("farmer_profiles")
    .insert([{
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      house_lat: profile.location?.lat,
      house_lng: profile.location?.lng,
      house_address: profile.locationAddress
    }])
    .select()
    .single();

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
  return data;
}

export async function createFarms(farmerId: string, farms: any[]) {
  const { data, error } = await supabase
    .from("farms")
    .insert(
      farms.map((f, idx) => ({
        farmer_id: farmerId,
        farm_index: idx + 1,
        area: f.area,
        soil_type: f.soilType,
        irrigation: f.irrigation
      }))
    )
    .select();

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
  return data;
}

export async function createCropCycles(farmsInserted: any[], selections: any[]) {
  const inserts = farmsInserted.map((farm, idx) => ({
    farm_id: farm.id,
    chosen_crop: selections[idx].chosenCrop,
    seeding_date: selections[idx].seedingDate,
    expected_yield: null
  }));

  const { error } = await supabase
    .from("crop_cycles")
    .insert(inserts);

  if (error) { console.error("SUPABASE ERROR:", error); throw error; }
}