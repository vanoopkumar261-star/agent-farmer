import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

/**
 * The signed-in user, but only if the session is genuinely still alive.
 *
 * `supabase.auth.getUser()` is not enough on its own. Supabase access tokens are
 * stateless JWTs that stay valid until they expire, so a token keeps being
 * accepted even after the account behind it is gone. That is not theoretical —
 * it happened here: after the database was wiped, a browser holding an
 * hour-long token sailed past the onboarding auth gate and landed straight on
 * the farm-registration form, prefilled with the deleted account's email. Any
 * profile insert would then have failed on the `owner_id → auth.users` foreign
 * key, long after the farmer had filled the form in.
 *
 * Refreshing settles it. Refresh tokens live in a real table and are removed
 * with the user, so a refresh succeeds only if the account still exists. When
 * it fails we clear the dead cookie so the farmer is simply asked to sign in.
 *
 * Returns null when there is no usable session.
 */
export async function getLiveUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.user) {
    // The token outlived its account. Drop it rather than half-trust it.
    await supabase.auth.signOut().catch(() => {});
    return null;
  }

  return refreshed.user;
}
