/**
 * Language codes shared by the voice features.
 *
 * Listening goes through Groq Whisper (/api/transcribe), which wants ISO-639-1.
 * Speaking is Chatterbox Indic via /api/tts, which takes the app locale as-is.
 */

import type { Locale } from "./i18n/config";

/**
 * BCP-47 tags for the speech APIs. Indian English is deliberate for `en` —
 * these are Indian farmers, and en-IN voices exist on most devices here.
 */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  pa: "pa-IN",
};

/** ISO-639-1, which is what Whisper's `language` parameter expects. */
export const LOCALE_ISO639: Record<Locale, string> = {
  en: "en",
  hi: "hi",
  kn: "kn",
  ta: "ta",
  te: "te",
  ml: "ml",
  mr: "mr",
  bn: "bn",
  pa: "pa",
};

export function bcp47(locale: string): string {
  return LOCALE_BCP47[locale as Locale] ?? "en-IN";
}

export function iso639(locale: string): string {
  return LOCALE_ISO639[locale as Locale] ?? "en";
}

/** Unicode block per script, for guessing a reply's language from its letters. */
const SCRIPT_RANGES: [Locale, number, number][] = [
  ["bn", 0x980, 0x9ff],
  ["pa", 0xa00, 0xa7f],
  ["ta", 0xb80, 0xbff],
  ["te", 0xc00, 0xc7f],
  ["kn", 0xc80, 0xcff],
  ["ml", 0xd00, 0xd7f],
];

/**
 * Which language a piece of text is written in, judged by its script.
 *
 * Needed because a reply restored from saved history carries no record of the
 * language it was written in, and the farmer may since have switched. Reading
 * an English answer with a Kannada voice is gibberish, so guessing from the
 * letters beats assuming the current language.
 *
 * Devanagari is shared by Hindi and Marathi and cannot be told apart this way,
 * so `fallback` decides — it is right whenever the farmer is in one of them.
 */
export function localeFromScript(text: string, fallback: string): Locale {
  let latin = 0;
  let devanagari = 0;
  const counts = new Map<Locale, number>();

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
      latin++;
      continue;
    }
    if (cp >= 0x900 && cp <= 0x97f) {
      devanagari++;
      continue;
    }
    for (const [code, lo, hi] of SCRIPT_RANGES) {
      if (cp >= lo && cp <= hi) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  let best: Locale | null = null;
  let bestN = 0;
  for (const [code, n] of counts) {
    if (n > bestN) {
      best = code;
      bestN = n;
    }
  }

  // Indic script wins over Latin: a Kannada reply still carries crop names and
  // units in Latin letters, and those must not outvote the language itself.
  if (best && bestN > 0) return best;
  if (devanagari > 0) return fallback === "mr" ? "mr" : "hi";
  if (latin > 0) return "en";
  return (fallback as Locale) ?? "en";
}
