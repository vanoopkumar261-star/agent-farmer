import { cache } from "react";
import { createSupabaseServer } from "./supabase-server";
import { cropStageFor } from "./agronomy";

export type FarmerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  house_lat: number | null;
  house_lng: number | null;
  house_address: string | null;
  created_at: string | null;
  preferences?: Record<string, any> | null;
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
  /** Farmer-set harvest date. Null on cycles created before migration 009 — callers fall back to the agronomy estimate. */
  estimated_harvest_date: string | null;
  expected_yield: string | null;
  created_at?: string | null;
};

export type FarmWithCrop = FarmRow & { crop: CropCycleRow | null };

export type DashboardData = {
  farmer: FarmerProfile | null;
  farms: FarmWithCrop[];
};

/**
 * Loads the signed-in farmer and their farms + crop cycles in a single nested
 * query, scoped by the session's owner_id (RLS also enforces this). Wrapped in
 * React cache() so the layout and the page share one fetch per request.
 * Returns an empty result when no user is signed in or the user hasn't onboarded.
 */
export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { farmer: null, farms: [] };

  const { data, error } = await supabase
    .from("farmer_profiles")
    .select("*, farms(*, crop_cycles(*))")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) console.error("DASHBOARD error:", error);
  if (!data) return { farmer: null, farms: [] };

  const { farms: rawFarms, ...farmer } = data as any;

  const farms: FarmWithCrop[] = ((rawFarms ?? []) as any[])
    .map((f) => {
      // Newest first. This used to take whatever Postgres returned, which was
      // harmless while nothing created a second cycle per farm — but the soil
      // advice now turns on "the crop growing NOW", and an unordered pick would
      // happily correct a wheat farmer's pH for last season's paddy.
      const cycles = [...((f.crop_cycles ?? []) as CropCycleRow[])].sort((a, b) =>
        (b.seeding_date ?? "").localeCompare(a.seeding_date ?? "")
      );
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

/**
 * Growth stage for a crop. Delegates to the crop-aware agronomy engine — pass
 * the crop name for per-crop cycle timing; without it, a 120-day default is used.
 * A farmer-set harvest date, when given, defines the window instead.
 */
export function cropStage(
  seedingDate: string,
  crop?: string,
  estimatedHarvestDate?: string | null
): CropStage {
  const s = cropStageFor(crop ?? "", seedingDate, estimatedHarvestDate);
  return { label: s.label, progress: s.progress };
}
