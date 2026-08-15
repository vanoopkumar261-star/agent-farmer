/**
 * Browser speech capability layer.
 *
 * Everything voice-related reads its language codes and its "can we even do
 * this here?" answers from this one module, so the rest of the feature never
 * touches `window.speechSynthesis` or the vendor-prefixed recognition object
 * directly.
 *
 * The honest constraint this file exists to express: speech OUTPUT is an
 * operating-system capability, not something the app can provide. Measured in
 * Chrome on Windows, only English (8 voices) and Hindi (1) had a voice
 * installed — Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali and Punjabi
 * had none. Speech INPUT is unaffected: Chrome recognises all nine server-side.
 * So callers must ask `hasVoiceFor(locale)` and hide the control when it is
 * false, rather than rendering a button that does nothing.
 */

import type { Locale } from "./i18n/config";

/**
 * Voice is English-only, deliberately.
 *
 * The text assistant still works in all nine languages — this limit applies to
 * speaking and listening only. Reasons it is scoped this way:
 *   · English has real device voices everywhere (8 on this machine, incl.
 *     en-IN Ravi and Heera), so speech needs no server and no downloads;
 *   · recognition accuracy and the quality of spoken replies are both far
 *     better in English than in the eight Indic languages;
 *   · it keeps one voice path to reason about instead of nine.
 *
 * Every voice surface reads this one flag, so widening it later means editing
 * this list and nothing else.
 */
export const VOICE_LOCALES: readonly string[] = ["en"];

/** The language voice actually runs in, whatever the UI is set to. */
export const VOICE_LOCALE = "en";

/** Whether the mic, voice mode and speaker controls should exist at all. */
export function voiceEnabledFor(locale: string): boolean {
  return VOICE_LOCALES.includes(locale);
}

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

/* ────────────────────────────── speech output ───────────────────────────── */

/**
 * `speechSynthesis.getVoices()` is populated asynchronously — probing this
 * browser, the very first call returned an EMPTY array and the list only filled
 * in a few hundred milliseconds later. Anything that reads it once on mount
 * therefore concludes "no voices" and silently disables itself forever. We keep
 * a cache and refresh it on `voiceschanged`.
 */
let voiceCache: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();
let listening = false;

function refreshVoices() {
  voiceCache = window.speechSynthesis.getVoices();
  voiceListeners.forEach((fn) => fn());
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Current voice list, priming the cache and the `voiceschanged` subscription. */
export function getVoices(): SpeechSynthesisVoice[] {
  if (!speechSynthesisSupported()) return [];
  if (!listening) {
    listening = true;
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }
  if (voiceCache.length === 0) voiceCache = window.speechSynthesis.getVoices();
  return voiceCache;
}

/**
 * Subscribe to voice-list changes. Components use this so a button that was
 * correctly hidden at first paint appears once the list arrives.
 * Returns an unsubscribe function.
 *
 * The `voiceschanged` event alone is NOT enough, and this was observed failing
 * in the real app: Chrome fires it once, and if that happens before React has
 * mounted and subscribed, the event is simply missed and the list appears to
 * stay empty forever — every speaker button stayed hidden even though 24 voices
 * were loaded. So we also poll briefly as a backstop and stop as soon as
 * voices show up.
 */
export function onVoicesChanged(fn: () => void): () => void {
  getVoices(); // ensure the listener is attached
  voiceListeners.add(fn);

  let tries = 0;
  const poll = window.setInterval(() => {
    tries += 1;
    const live = window.speechSynthesis?.getVoices() ?? [];
    if (live.length > 0) {
      voiceCache = live;
      fn();
      window.clearInterval(poll);
    } else if (tries >= 12) {
      // ~3s. The device genuinely has no voices; stop burning timers.
      window.clearInterval(poll);
    }
  }, 250);

  return () => {
    window.clearInterval(poll);
    voiceListeners.delete(fn);
  };
}

/**
 * Best available voice for a locale, or null when the device has none.
 *
 * Prefers an exact tag match (hi-IN), then any voice for the same base language
 * (hi-*), because a `hi` voice from another region still speaks Hindi.
 */
export function getVoiceFor(locale: string): SpeechSynthesisVoice | null {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const tag = bcp47(locale).toLowerCase();
  const base = tag.split("-")[0];

  const exact = voices.find((v) => v.lang.toLowerCase() === tag);
  if (exact) return exact;

  const sameLanguage = voices.find((v) => v.lang.toLowerCase().split("-")[0] === base);
  return sameLanguage ?? null;
}

/** Whether this device can speak the given locale at all. */
export function hasVoiceFor(locale: string): boolean {
  return getVoiceFor(locale) !== null;
}

/* ────────────────────────────── speech input ────────────────────────────── */

type SpeechRecognitionCtor = new () => any;

/**
 * The Web Speech recognition constructor, or null. Chrome/Edge expose it
 * unprefixed or as `webkitSpeechRecognition`; Firefox has neither, which is
 * exactly the case the Groq Whisper fallback covers.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function webSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/** Whether we can record audio at all, for the Whisper fallback path. */
export function mediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Any usable microphone path. Also requires a secure context — getUserMedia and
 * Web Speech both refuse to run over plain HTTP (localhost counts as secure).
 */
export function voiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return webSpeechRecognitionSupported() || mediaRecorderSupported();
}
