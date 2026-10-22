import type { Locale } from "@/lib/i18n/config";

/**
 * Tier 1 of the voice architecture: a deterministic phrase match that
 * short-circuits BEFORE the transcribed text ever reaches a model.
 *
 * Ported from agent-farmer-mobile/src/lib/agent/localCommands.ts. The phrase
 * table is carried over verbatim — it is not a fresh translation. Every entry
 * is a label already shown somewhere in the UI (nav.market, title.soilPh, …),
 * on the principle that a farmer who can read "ಮಾರುಕಟ್ಟೆ" on the market button
 * saying that exact word is the most natural command there is. Only the routes
 * differ, because expo-router paths are not Next.js ones.
 *
 * ⚠ The same correction the mobile file carries applies here: this does NOT
 * make voice work offline. Transcription is still a cloud Whisper call
 * (/api/transcribe). What this tier buys is narrower but real — for the
 * highest-frequency commands it saves the Groq call, the RAG retrieval, and
 * their latency and rate-limit cost, by matching text Whisper already produced
 * instead of asking a model to interpret it.
 *
 * Deliberately NOT included, with reasons carried over from mobile:
 *   - "stop" — a close button already exists; true speech barge-in is later
 *     scope.
 *   - "change language" — cut deliberately, not merely unbuilt. Setting the
 *     WRONG language from a misheard word is a far worse failure than opening
 *     the picker for a safe tap: a farmer locked into a script they cannot
 *     read has no way to ask to be let out. If this ever ships it routes to
 *     the picker, never sets a locale directly.
 */

export type LocalCommand =
  | { type: "navigate"; route: string; intent: string }
  | { type: "undo" }
  | { type: "repeat" };

/**
 * Intent key -> the Next.js route.
 *
 * The mobile app has screens this one does not and vice versa: `today` is the
 * dashboard here, `learn` is the Jaivik Sathi library, and `alerts` has no
 * page of its own — the dashboard's alerts card is where they live, so it
 * points there rather than inventing a destination.
 */
const ROUTES: Record<string, string> = {
  today: "/dashboard",
  crops: "/dashboard/crops",
  assistant: "/dashboard/assistant",
  market: "/dashboard/market",
  news: "/dashboard/news",
  learn: "/jaivik-sathi/library",
  money: "/dashboard/expenses",
  schemes: "/dashboard/schemes",
  settings: "/dashboard/settings",
  soil: "/dashboard/soil",
  alerts: "/dashboard",
  scan: "/dashboard/disease",
  stores: "/dashboard/store-locator",
  // Web-only destinations. The mobile hub has no equivalent of either.
  irrigation: "/dashboard/irrigation",
  inputs: "/dashboard/inputs",
};

type PhraseTable = Record<string, string[]>;

/**
 * One primary phrase per intent per locale. English carries two or three
 * variants because it is the language most likely to be spoken mixed with
 * loanwords ("open the market" as well as just "market").
 */
const PHRASES: Record<Locale, PhraseTable> = {
  en: {
    today: ["today", "home", "dashboard", "today's tasks"],
    crops: ["my farms", "crops", "my crops"],
    assistant: ["ai assistant", "assistant", "chat"],
    market: ["market", "mandi", "open the market"],
    news: ["news"],
    learn: ["library"],
    money: ["expenses", "money", "expense tracker"],
    schemes: ["gov. schemes", "government schemes", "schemes"],
    settings: ["settings"],
    soil: ["soil", "soil ph"],
    alerts: ["alerts", "warnings"],
    scan: ["scan leaf", "scan", "disease detection", "camera"],
    stores: ["shops", "stores", "store locator", "nearby shops"],
    irrigation: ["irrigation", "watering"],
    inputs: ["input prices"],
    undo: ["undo"],
    repeat: ["repeat", "say that again", "say again"],
  },
  hi: {
    today: ["आज"],
    crops: ["मेरे खेत"],
    assistant: ["एआई सहायक"],
    market: ["बाज़ार"],
    news: ["समाचार"],
    learn: ["लाइब्रेरी"],
    money: ["खर्च"],
    schemes: ["सरकारी योजनाएँ"],
    settings: ["सेटिंग्स"],
    soil: ["मिट्टी"],
    alerts: ["चेतावनियाँ"],
    scan: ["पत्ती जाँच"],
    stores: ["दुकानें"],
    irrigation: ["सिंचाई"],
    inputs: ["इनपुट क़ीमतें"],
    undo: ["वापस"],
    repeat: ["दोहराओ", "फिर से बोलो"],
  },
  kn: {
    today: ["ಇಂದು"],
    crops: ["ನನ್ನ ಜಮೀನುಗಳು"],
    assistant: ["ಎಐ ಸಹಾಯಕ"],
    market: ["ಮಾರುಕಟ್ಟೆ"],
    news: ["ಸುದ್ದಿ"],
    learn: ["ಗ್ರಂಥಾಲಯ"],
    money: ["ವೆಚ್ಚಗಳು"],
    schemes: ["ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು"],
    settings: ["ಸೆಟ್ಟಿಂಗ್‌ಗಳು"],
    soil: ["ಮಣ್ಣು"],
    alerts: ["ಎಚ್ಚರಿಕೆಗಳು"],
    scan: ["ಎಲೆ ಪರೀಕ್ಷೆ"],
    stores: ["ಅಂಗಡಿಗಳು"],
    irrigation: ["ನೀರಾವರಿ"],
    inputs: ["ಪರಿಕರ ಬೆಲೆಗಳು"],
    undo: ["ಹಿಂದೆ"],
    repeat: ["ಪುನಃ ಹೇಳಿ", "ಮತ್ತೆ ಹೇಳಿ"],
  },
  ta: {
    today: ["இன்று"],
    crops: ["எனது பண்ணைகள்"],
    assistant: ["ஏஐ உதவியாளர்"],
    market: ["சந்தை"],
    news: ["செய்திகள்"],
    learn: ["நூலகம்"],
    money: ["செலவுகள்"],
    schemes: ["அரசு திட்டங்கள்"],
    settings: ["அமைப்புகள்"],
    soil: ["மண்"],
    alerts: ["எச்சரிக்கைகள்"],
    scan: ["இலை பரிசோதனை"],
    stores: ["கடைகள்"],
    irrigation: ["நீர்ப்பாசனம்"],
    inputs: ["இடுபொருள் விலைகள்"],
    undo: ["திரும்ப"],
    repeat: ["மீண்டும் சொல்லு", "மறுபடி சொல்லு"],
  },
  te: {
    today: ["ఈరోజు"],
    crops: ["నా పొలాలు"],
    assistant: ["ఏఐ సహాయకుడు"],
    market: ["మార్కెట్"],
    news: ["వార్తలు"],
    learn: ["గ్రంథాలయం"],
    money: ["ఖర్చులు"],
    schemes: ["ప్రభుత్వ పథకాలు"],
    settings: ["సెట్టింగ్‌లు"],
    soil: ["నేల"],
    alerts: ["హెచ్చరికలు"],
    scan: ["ఆకు పరీక్ష"],
    stores: ["దుకాణాలు"],
    irrigation: ["నీటిపారుదల"],
    inputs: ["ఇన్‌పుట్ ధరలు"],
    undo: ["వెనక్క"],
    repeat: ["మళ్లీ చెప్పు", "మళ్ళీ చెప్పండి"],
  },
  ml: {
    today: ["ഇന്ന്"],
    crops: ["എന്റെ കൃഷിയിടങ്ങൾ"],
    assistant: ["എഐ അസിസ്റ്റന്റ്"],
    market: ["മാർക്കറ്റ്"],
    news: ["വാർത്തകൾ"],
    learn: ["ലൈബ്രറി"],
    money: ["ചെലവുകൾ"],
    schemes: ["സർക്കാർ പദ്ധതികൾ"],
    settings: ["ക്രമീകരണങ്ങൾ"],
    soil: ["മണ്ണ്"],
    alerts: ["മുന്നറിയിപ്പുകൾ"],
    scan: ["ഇല പരിശോധന"],
    stores: ["കടകൾ"],
    irrigation: ["ജലസേചനം"],
    inputs: ["ഇൻപുട്ട് വിലകൾ"],
    undo: ["പഴയപടി"],
    repeat: ["വീണ്ടും പറയൂ", "ഒന്നുകൂടി പറയൂ"],
  },
  mr: {
    today: ["आज"],
    crops: ["माझी शेते"],
    assistant: ["एआय सहाय्यक"],
    market: ["बाजार"],
    news: ["बातम्या"],
    learn: ["लायब्ररी"],
    money: ["खर्च"],
    schemes: ["सरकारी योजना"],
    settings: ["सेटिंग्ज"],
    soil: ["माती"],
    alerts: ["इशारे"],
    scan: ["पान तपासणी"],
    stores: ["दुकाने"],
    irrigation: ["सिंचन"],
    inputs: ["निविष्ठा किंमती"],
    undo: ["मागे"],
    repeat: ["पुन्हा सांगा", "परत सांगा"],
  },
  bn: {
    today: ["আজ"],
    crops: ["আমার খামার"],
    assistant: ["এআই সহায়ক"],
    market: ["বাজার"],
    news: ["সংবাদ"],
    learn: ["লাইব্রেরি"],
    money: ["খরচ"],
    schemes: ["সরকারি প্রকল্প"],
    settings: ["সেটিংস"],
    soil: ["মাটি"],
    alerts: ["সতর্কতা"],
    scan: ["পাতা পরীক্ষা"],
    stores: ["দোকান"],
    irrigation: ["সেচ"],
    inputs: ["উপকরণ দাম"],
    undo: ["ফিরি"],
    repeat: ["আবার বলো", "আবার বলুন"],
  },
  pa: {
    today: ["ਅੱਜ"],
    crops: ["ਮੇਰੇ ਖੇਤ"],
    assistant: ["ਏਆਈ ਸਹਾਇਕ"],
    market: ["ਬਾਜ਼ਾਰ"],
    news: ["ਖ਼ਬਰਾਂ"],
    learn: ["ਲਾਇਬ੍ਰੇਰੀ"],
    money: ["ਖਰਚੇ"],
    schemes: ["ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ"],
    settings: ["ਸੈਟਿੰਗਾਂ"],
    soil: ["ਮਿੱਟੀ"],
    alerts: ["ਚੇਤਾਵਨੀਆਂ"],
    scan: ["ਪੱਤਾ ਜਾਂਚ"],
    stores: ["ਦੁਕਾਨਾਂ"],
    irrigation: ["ਸਿੰਚਾਈ"],
    inputs: ["ਇਨਪੁਟ ਕੀਮਤਾਂ"],
    undo: ["ਵਾਪਸ"],
    repeat: ["ਦੁਬਾਰਾ ਬੋਲੋ", "ਫਿਰ ਬੋਲੋ"],
  },
};

/** Strips punctuation and collapses whitespace. Case-folding is a harmless no-op for Indic scripts. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:।॥"'`()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches transcribed speech against the phrase table. Conservative on
 * purpose, and both guards are load-bearing:
 *
 *   - at most 6 words, because a real question rarely fits in six; and
 *   - the matched phrase must cover at least 35% of what was said.
 *
 * Together they let a bare "market" match "open the market" while rejecting
 * "why did market prices fall this week" — mis-routing to a screen the farmer
 * did not ask for is worse than falling through to the assistant, which still
 * answers sensibly either way.
 */
export function matchLocalCommand(heardText: string, locale: string): LocalCommand | null {
  const heard = normalize(heardText);
  if (!heard) return null;
  if (heard.split(" ").length > 6) return null;

  const table = PHRASES[locale as Locale] ?? PHRASES.en;
  let best: { intent: string; phrase: string } | null = null;

  for (const [intent, phrases] of Object.entries(table)) {
    for (const raw of phrases) {
      const phrase = normalize(raw);
      if (!phrase) continue;
      if (heard.includes(phrase)) {
        if (phrase.length / heard.length < 0.35) continue;
        if (!best || phrase.length > best.phrase.length) best = { intent, phrase };
      }
    }
  }

  if (!best) return null;
  if (best.intent === "undo") return { type: "undo" };
  if (best.intent === "repeat") return { type: "repeat" };
  const route = ROUTES[best.intent];
  return route ? { type: "navigate", route, intent: best.intent } : null;
}
