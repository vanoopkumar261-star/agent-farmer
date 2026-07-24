import { cache } from "react";
import { supabase } from "./supabase";

export type FarmerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  house_lat: number | null;
  house_lng: number | null;
  house_address: string | null;
  created_at: string | null;
};

export type FarmRow = {
  id: string;
  farmer_id: string;
  farm_index: number;
  area: number;
  soil_type: string;
  irrigation: string;
};

export type CropCycleRow = {
  id: string;
  farm_id: string;
  chosen_crop: string;
  seeding_date: string;
  expected_yield: string | null;
};

export type FarmWithCrop = FarmRow & { crop: CropCycleRow | null };

export type DashboardData = {
  farmer: FarmerProfile | null;
  farms: FarmWithCrop[];
};

/**
 * Loads the most recently created farmer and their farms + crop cycles in a
 * single nested query. Wrapped in React cache() so the layout and the page
 * share one fetch per request instead of re-querying.
 * No auth yet, so "current farmer" = latest profile — fine for the MVP demo.
 */
export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const { data, error } = await supabase
    .from("farmer_profiles")
    .select("*, farms(*, crop_cycles(*))")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error("DASHBOARD error:", error);
  if (!data) return { farmer: null, farms: [] };

  const { farms: rawFarms, ...farmer } = data as any;

  const farms: FarmWithCrop[] = ((rawFarms ?? []) as any[])
    .map((f) => {
      const cycles = (f.crop_cycles ?? []) as CropCycleRow[];
      const { crop_cycles, ...farmRow } = f;
      return { ...(farmRow as FarmRow), crop: cycles[0] ?? null };
    })
    .sort((a, b) => a.farm_index - b.farm_index);

  return { farmer: farmer as FarmerProfile, farms };
});

/** Days since seeding — drives crop stage + task derivation. */
export function daysSince(dateISO: string): number {
  const then = new Date(dateISO).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/** Human relative time from a timestamp, e.g. "just now", "3 hours ago", "2 days ago". */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export type CropStage = {
  label: string;
  progress: number; // 0..1 through a ~120-day cycle
};

export function cropStage(seedingDate: string): CropStage {
  const d = daysSince(seedingDate);
  const cycle = 120;
  const progress = Math.min(1, d / cycle);
  let label = "Germination";
  if (d > 90) label = "Maturity";
  else if (d > 55) label = "Flowering";
  else if (d > 25) label = "Vegetative";
  else if (d > 7) label = "Seedling";
  return { label, progress };
}
