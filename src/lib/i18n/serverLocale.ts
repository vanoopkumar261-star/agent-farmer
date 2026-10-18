import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, STORAGE_KEY, type Locale } from "./config";

/**
 * The farmer's chosen language, read on the server.
 *
 * The app's language setting lives client-side — `LanguageProvider` keeps it in
 * `localStorage` and renders through a context, which is the right design for a
 * switch that must not reload the page. A server component cannot see
 * `localStorage`, so `setLocale` also mirrors the choice into an `af_locale`
 * cookie, and that mirror is what this reads.
 *
 * Needed because machine translation belongs on the server: the irrigation page
 * already computes every plan there, so translating the engine's prose in the
 * same pass means the farmer's first paint is already in their language. Doing
 * it in the browser would ship English, then replace it a second later.
 *
 * Falls back to English when the cookie is absent, which is the honest answer —
 * a farmer who has never opened the language switcher is being served English,
 * and the client will re-render in their language if `localStorage` disagrees.
 *
 * Only usable from a server component or route handler; `next/headers` throws
 * anywhere else. That is also why it lives here and not in `config.ts`, which
 * is imported by client components.
 */
export function getServerLocale(): Locale {
  try {
    const raw = cookies().get(STORAGE_KEY)?.value;
    const hit = LOCALES.find((l) => l.code === raw);
    return hit ? (hit.code as Locale) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
