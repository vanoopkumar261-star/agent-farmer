import { supabase } from "@/lib/supabase";
import { isTheme, type Theme } from "@/lib/theme/config";

/**
 * The theme preference, stored per farmer.
 *
 * Lives in the `farmer_profiles.preferences` jsonb alongside `tour_version`,
 * `oilseed_ack`, `house_pincode` and the notification toggles — the same place
 * every other per-farmer preference already goes, so this needs no migration
 * and no new column. See `src/lib/tour.ts`, which this mirrors exactly.
 *
 * Why store it at all, when the cookie already works: a farmer who sets dark
 * on the phone they use in the field should find dark on the laptop at home.
 * The cookie cannot cross devices; this can.
 */

/**
 * Merge the chosen theme into the farmer's preferences.
 *
 * Reads first and spreads, never writes blind — this blob holds four other
 * keys and a blind write would quietly reset the tour, the oilseed
 * acknowledgement and every notification toggle.
 *
 * Never throws, and is never awaited by the UI. The theme has already been
 * applied locally by the time this runs; a failed write means the choice lives
 * on this device until the next toggle, which is a far better failure than a
 * switch that appears to do nothing while the network times out.
 */
export async function saveThemePreference(farmerId: string, theme: Theme): Promise<void> {
  try {
    const { data } = await supabase
      .from("farmer_profiles")
      .select("preferences")
      .eq("id", farmerId)
      .maybeSingle();

    const existing = (data?.preferences as Record<string, any> | null) ?? {};

    await supabase
      .from("farmer_profiles")
      .update({ preferences: { ...existing, theme } })
      .eq("id", farmerId);
  } catch {
    /* preferences column missing or offline — the local choice already took */
  }
}

/** The stored theme, or null when the farmer has never chosen one. */
export function themeFromPreferences(
  preferences: Record<string, any> | null | undefined
): Theme | null {
  const stored = preferences?.theme;
  return isTheme(stored) ? stored : null;
}
