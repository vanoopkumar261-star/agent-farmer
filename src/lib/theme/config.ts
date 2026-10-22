/**
 * The theme setting, shared by client and server.
 *
 * Deliberately a twin of `src/lib/i18n/config.ts`: the same split between a
 * client-safe module (this one) and a server-only reader (`serverTheme.ts`,
 * which imports `next/headers` and therefore cannot be imported by a client
 * component). Same storage key convention, same cookie, same one-year life.
 */

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/**
 * Light, not dark, and not the device setting.
 *
 * Dark mode is opt-in: a farmer who has never touched the switch sees exactly
 * the product that was there yesterday. It also means a logged-out visitor on
 * the landing page gets the same first impression we have always shipped.
 */
export const DEFAULT_THEME: Theme = "light";

/** localStorage key and cookie name — one string, so they cannot drift. */
export const STORAGE_KEY = "af_theme";

/** A year, matching the locale cookie. */
export const COOKIE_MAX_AGE = 31536000;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** The cookie string `setTheme` writes, kept here so the pre-paint script in
 *  layout.tsx and the provider cannot disagree about its shape. */
export function themeCookie(theme: Theme): string {
  return `${STORAGE_KEY}=${theme};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}
