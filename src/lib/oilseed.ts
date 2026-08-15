/**
 * Oilseed awareness — shared constants and content.
 *
 * The awareness page sits between "I am a Farmer" on the landing page and the
 * registration wizard. The farmer's answer is carried to onboarding in
 * sessionStorage (this key), then persisted onto farmer_profiles.preferences
 * when the profile is created. Acknowledging only asks the recommendation
 * engine to surface a suitable oilseed among the options — it never overrides
 * agronomic suitability, and "No thanks" leaves the existing logic untouched.
 */

import { supabase } from "./supabase";

export const OILSEED_ACK_KEY = "af_oilseed_ack";

export type OilseedAnswer = "yes" | "no";

/** Records the farmer's answer for the registration step that follows. */
export function storeOilseedAnswer(answer: OilseedAnswer) {
  try {
    sessionStorage.setItem(OILSEED_ACK_KEY, answer);
  } catch {
    /* storage unavailable — onboarding just treats it as unanswered */
  }
}

/**
 * The farmer's oilseed answer, or null if they've never given one.
 *
 * Checks this session first (they just came from the awareness page), then falls
 * back to the answer saved on their profile. The fallback is what makes the
 * choice durable: a returning farmer adding a farm months later still gets
 * oilseeds considered without being asked again.
 */
export async function loadOilseedAck(): Promise<boolean | null> {
  try {
    const raw = sessionStorage.getItem(OILSEED_ACK_KEY);
    if (raw === "yes") return true;
    if (raw === "no") return false;
  } catch {
    /* storage unavailable — fall through to the profile */
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("farmer_profiles")
      .select("preferences")
      .eq("owner_id", user.id)
      .maybeSingle();

    const stored = (data?.preferences as Record<string, any> | null)?.oilseed_ack;
    return typeof stored === "boolean" ? stored : null;
  } catch {
    return null;
  }
}
