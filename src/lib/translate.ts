/**
 * Machine translation via Groq, for text the dictionaries cannot hold.
 *
 * ── Why this exists at all ────────────────────────────────────────────────────
 *
 * `src/lib/i18n/` covers every string an author wrote. It cannot cover strings
 * the *engine* writes, and the irrigation engine writes a lot of them:
 *
 *     "Wheat at flowering uses about 5.2 mm a day right now"
 *     "Rain in the forecast covers about 11.4 mm you would otherwise have pumped"
 *
 * Those are composed at request time from the farm's own numbers, its crop and
 * its growth stage. A dictionary key with parameters would translate the frame
 * and leave the crop name and the stage in English, producing a half-Hindi
 * sentence — which reads worse than leaving the whole thing in English. A
 * translation model takes the finished sentence and renders all of it.
 *
 * So the split is deliberate, and it is the whole design:
 *
 *     static UI copy      → dictionaries, pre-translated, zero latency
 *     engine-composed prose → here, at request time, cached
 *
 * ── Why Groq and not a dedicated translation model ───────────────────────────
 *
 * This used to call NVIDIA Riva Translate. Every AI feature in the app now runs
 * on one provider, so there is one key to rotate, one rate limit to reason about
 * and one outage to handle. `gpt-oss-120b` was checked against the engine's own
 * sentences in Hindi and Kannada before the swap: it keeps the figures and units
 * intact ("5.2 mm" → "5.2 मिमी") and reads naturally, and it needs none of
 * Riva's fragile `en-hi` pair-tag protocol, which silently returned Danish when
 * the tag was a character off.
 *
 * ── Which locales this touches ───────────────────────────────────────────────
 *
 * Only the ones in `TRANSLATE_LOCALES`. Every other locale is returned
 * unchanged, byte for byte, and makes no network call. That is enforced in code
 * rather than left to whoever edits the config next, because "we only enabled
 * Hindi" is a decision that quietly stops being true the moment someone adds a
 * locale to an array elsewhere. Today Hindi is the only entry; the other seven
 * render the engine's English exactly as they did before this file existed.
 *
 * ── Failure ──────────────────────────────────────────────────────────────────
 *
 * Every path returns the English input. No key, no network, a 500 from Groq,
 * a malformed reply, a timeout — the caller gets usable text in all five cases.
 * A farmer who needs to know whether to run a pump this morning is not served
 * by an error where the reason used to be, and this is garnish on numbers that
 * were already computed and are already on screen.
 */

import type { Locale } from "./i18n/config";
import { fetchWithRetry, GROQ_TEXT_MODEL } from "./http";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * The locales machine translation is enabled for.
 *
 * English is the source and is never sent anywhere. Adding a locale here is the
 * only thing needed to turn it on — the model covers all nine of the app's
 * languages — but it is a deliberate act, not a default, because MT output is
 * unreviewed by definition and the hand-written dictionaries are not.
 */
export const TRANSLATE_LOCALES: readonly Locale[] = ["hi"];

/**
 * Locale → the language's English name, as the instruction names it.
 *
 * A general-purpose model wants the language said plainly. The old Riva path
 * needed an exact `en-hi` pair tag in the system slot and silently returned
 * Danish for anything it did not recognise, so the mapping stays explicit here
 * too: an unlisted locale refuses to translate rather than improvising.
 */
const LANGUAGE_NAME: Partial<Record<Locale, string>> = {
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  pa: "Punjabi",
};

export function translationEnabled(locale: Locale): boolean {
  return (
    locale !== "en" &&
    TRANSLATE_LOCALES.includes(locale) &&
    !!LANGUAGE_NAME[locale] &&
    !!process.env.GROQ_API_KEY
  );
}

/**
 * Translated strings, keyed by `locale\u0000english`.
 *
 * Process-lifetime and unbounded-until-capped. The same sentences recur
 * constantly — the engine's factor lines are templated, so two farms on the
 * same crop and stage produce identical prose, and a farmer reloading the page
 * produces it again. Caching turns a page view into zero upstream calls on
 * every visit after the first.
 *
 * Deliberately not a database table: these are derived from strings already in
 * the source tree, so a cold cache costs one call to rebuild and nothing is
 * lost when the process restarts.
 */
const cache = new Map<string, string>();
const CACHE_MAX = 2000;

function cacheKey(locale: Locale, text: string) {
  return `${locale}\u0000${text}`;
}

function remember(locale: Locale, text: string, translated: string) {
  // Oldest-first eviction. Map preserves insertion order, so the first key is
  // the least recently added — enough for a cache whose contents are a few
  // hundred recurring sentences, without pulling in an LRU dependency.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey(locale, text), translated);
}

/**
 * Translates one string. Returns the input unchanged on any failure.
 *
 * Exported mainly for the generation script; page code should prefer
 * `translateMany`, which shares one round of concurrency across a whole page.
 */
export async function translateText(text: string, locale: Locale): Promise<string> {
  const trimmed = text?.trim();
  if (!trimmed) return text;
  if (!translationEnabled(locale)) return text;

  const hit = cache.get(cacheKey(locale, trimmed));
  if (hit) return hit;

  try {
    const res = await fetchWithRetry(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          // A general model will happily explain, transliterate or wrap the
          // answer in quotes unless told not to — and any of those would be
          // spliced straight into the page as if it were the translation.
          messages: [
            {
              role: "system",
              content: `You are a translation engine. Translate the user message from English into ${LANGUAGE_NAME[locale]}. Output ONLY the translation — no quotes, no notes, no transliteration, no explanation. Keep every number, unit and crop name accurate.`,
            },
            { role: "user", content: trimmed },
          ],
          // Translation is not a creative task, and a drifting temperature
          // means the same sentence caches differently on two page loads.
          temperature: 0,
          // Generous relative to the input: Indic scripts tokenise to roughly
          // twice the length of the English, and a truncated sentence is worse
          // than an untranslated one.
          max_tokens: Math.max(256, trimmed.length * 3),
        }),
        signal: AbortSignal.timeout(12_000),
      },
      { label: "groq/translate", retries: 1 }
    );

    if (!res.ok) {
      console.warn(`groq/translate: HTTP ${res.status} for ${locale}`);
      return text;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const out = data.choices?.[0]?.message?.content?.trim();

    // An empty or echoed reply is a failure wearing a 200. Falling through to
    // the English is the same outcome either way, but not caching it means the
    // next request gets another chance.
    if (!out) return text;

    remember(locale, trimmed, out);
    return out;
  } catch (e) {
    console.warn(`groq/translate: ${(e as Error)?.message || "failed"}`);
    return text;
  }
}

/**
 * Translates a batch, preserving order and length.
 *
 * `output[i]` always corresponds to `input[i]`, and is the English original
 * wherever translation was skipped or failed — so a caller can splice the
 * result straight back into whatever it came from without checking anything.
 *
 * Duplicates are collapsed before dispatch: a page showing four farms repeats
 * the same factor lines, and the model should see each distinct sentence once.
 * Concurrency is capped because the whole batch is one page render and a burst
 * of thirty parallel requests is how a free endpoint starts returning 429.
 */
export async function translateMany(texts: string[], locale: Locale): Promise<string[]> {
  if (!translationEnabled(locale)) return texts;

  const distinct = Array.from(new Set(texts.map((t) => t?.trim()).filter(Boolean) as string[]));
  if (!distinct.length) return texts;

  const resolved = new Map<string, string>();
  const CONCURRENCY = 6;

  for (let i = 0; i < distinct.length; i += CONCURRENCY) {
    const slice = distinct.slice(i, i + CONCURRENCY);
    const done = await Promise.all(slice.map((t) => translateText(t, locale)));
    slice.forEach((t, j) => resolved.set(t, done[j]));
  }

  return texts.map((t) => {
    const key = t?.trim();
    return (key && resolved.get(key)) || t;
  });
}
