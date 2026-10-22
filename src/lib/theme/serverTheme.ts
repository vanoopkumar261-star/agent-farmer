import { cookies } from "next/headers";
import { DEFAULT_THEME, STORAGE_KEY, isTheme, type Theme } from "./config";

/**
 * The farmer's chosen theme, read on the server.
 *
 * Same shape and same reason as `getServerLocale()`: the setting lives
 * client-side so the switch never reloads the page, and `setTheme` mirrors it
 * into an `af_theme` cookie so the server can render the right theme on the
 * first byte. Without that mirror, every dark-mode user would get one frame of
 * a white page — the flash this whole mechanism exists to prevent.
 *
 * Falls back to light when the cookie is absent, which is the honest answer:
 * someone who has never opened the switch is being served the light theme, and
 * the pre-paint script in `layout.tsx` will correct it from `localStorage` if
 * that disagrees (the cookie-less case after a browser clears cookies only).
 *
 * Only usable from a server component or route handler — `next/headers` throws
 * anywhere else, which is why this is not in `config.ts`.
 *
 * Note: calling this in the root layout opts the whole tree into dynamic
 * rendering. That is the accepted cost. Every dashboard route is already
 * `force-dynamic`, and the marketing pages carry a video hero and a Leaflet
 * map — they were never winning on static cache.
 */
export function getServerTheme(): Theme {
  try {
    const raw = cookies().get(STORAGE_KEY)?.value;
    return isTheme(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
