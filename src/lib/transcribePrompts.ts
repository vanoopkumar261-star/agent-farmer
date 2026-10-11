import type { Locale } from "./i18n/config";

/**
 * Per-locale Whisper `prompt` strategy for /api/transcribe.
 *
 * Whisper's `prompt` primes style AND language. Until 2026-09-07 this route
 * sent the same English domain hint — "Indian farming: crops, soil,
 * irrigation, mandi prices, weather." — for every locale. Measured on the live
 * Groq endpoint, that one string made six of the nine locales return fluent
 * ENGLISH prose instead of a transcription: a Kannada clip came back as "I am
 * the Indian, 2nd, and I am the Indian." The failure was invisible because the
 * three locales anyone tests by hand — en, hi, bn — are the three it does not
 * break, and the English output is fluent enough to look correct.
 *
 * This table is the result of the actual fix: a 384-call benchmark run against
 * Groq (`scripts/dryrun/accuracy.mjs`) over 12 utterances × 4 classes (rupee
 * amounts, crop/input names, short commands, scheme/date/symptom sentences) ×
 * 4 prompt strategies, scored on whether the entity that matters — the amount,
 * the crop, the command word — survived, not on whole-sentence match (Whisper
 * normalises "two thousand" to "2,000", and a word diff would call that a
 * failure). Full data and methodology: scripts/dryrun/accuracy.mjs.
 *
 * Per-locale winner, entity-recall vs. no prompt at all (n=12 each):
 *   hi  none                0.972  (a prompt only hurts — translated: 0.931)
 *   bn  none                0.847  (translated: 0.764 — same story)
 *   kn  vocab   +0.041      0.833
 *   te  vocab   +0.041      0.958
 *   mr  vocab   +0.097      0.847
 *   ta  translated +0.042   0.875
 *   pa  translated +0.042   0.931
 *   ml  translated +0.208   0.444  (still the weakest locale; see below)
 *
 * ⚠ Translations are machine-authored, not native-reviewed. They are prompt
 * material Whisper never surfaces to a farmer, and they measurably help rather
 * than hallucinate a wrong language the way the English string did — but they
 * should still get a native speaker's pass before anyone treats the exact
 * wording as authoritative.
 *
 * ⚠ Malayalam remains the weakest locale even after tuning (0.444 vs en's
 * 0.97+). The benchmark cannot tell whether that is Whisper or the MMS-TTS
 * synthesis it was tested against — real recordings are the next step, not
 * more prompt tuning.
 */

const DOMAIN_HINT: Partial<Record<Locale, string>> = {
  en: "Indian farming: crops, soil, irrigation, mandi prices, weather.",
  kn: "ಭಾರತೀಯ ಕೃಷಿ: ಬೆಳೆಗಳು, ಮಣ್ಣು, ನೀರಾವರಿ, ಮಂಡಿ ಬೆಲೆಗಳು, ಹವಾಮಾನ.",
  ta: "இந்திய விவசாயம்: பயிர்கள், மண், பாசனம், சந்தை விலைகள், வானிலை.",
  te: "భారతీయ వ్యవసాయం: పంటలు, నేల, నీటిపారుదల, మార్కెట్ ధరలు, వాతావరణం.",
  ml: "ഇന്ത്യൻ കൃഷി: വിളകൾ, മണ്ണ്, ജലസേചനം, മാർക്കറ്റ് വില, കാലാവസ്ഥ.",
  mr: "भारतीय शेती: पिके, माती, सिंचन, बाजारभाव, हवामान.",
  pa: "ਭਾਰਤੀ ਖੇਤੀ: ਫਸਲਾਂ, ਮਿੱਟੀ, ਸਿੰਚਾਈ, ਮੰਡੀ ਭਾਅ, ਮੌਸਮ।",
};

/** Appended to the domain hint where the benchmark showed it helps further. */
const VOCAB: Partial<Record<Locale, string[]>> = {
  kn: ["ಯೂರಿಯಾ", "ಡಿಎಪಿ", "ಪೊಟ್ಯಾಶ್", "ಭತ್ತ", "ಗೋಧಿ", "ಟೊಮೇಟೊ", "ಕಬ್ಬು", "ಕಿಸಾನ್"],
  te: ["యూరియా", "డీఏపీ", "పొటాష్", "ధాన్యం", "గోధుమ", "టమాటా", "చెరకు", "కిసాన్"],
  mr: ["युरिया", "डीएपी", "पोटॅश", "भात", "गहू", "टोमॅटो", "ऊस", "किसान"],
};

/** Locales where the measured best strategy is to send no prompt at all. */
const NO_PROMPT: ReadonlySet<Locale> = new Set(["hi", "bn"] as Locale[]);

/** Builds the exact `prompt` field to send Groq for this locale, or undefined. */
export function transcribePromptFor(locale: string): string | undefined {
  const loc = locale as Locale;
  if (loc === "en") return DOMAIN_HINT.en;
  if (NO_PROMPT.has(loc)) return undefined;

  const hint = DOMAIN_HINT[loc];
  if (!hint) return undefined; // an unrecognised locale gets no prompt, not a guess

  const vocab = VOCAB[loc];
  return vocab ? `${hint} ${vocab.join(", ")}.` : hint;
}
