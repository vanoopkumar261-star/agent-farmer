/**
 * Whisper `prompt` strategies to benchmark against the corpus in
 * fixtures/phrases.mjs.
 *
 * ⚠ Translations are machine-authored and need a native-speaker pass before
 * anything here ships into the app — same caveat as the corpus itself. They
 * only need to be close enough to bias Whisper's language and vocabulary
 * expectations; they are never shown to a farmer.
 *
 * Four variants, so the benchmark can attribute an improvement to a cause
 * rather than just observe a number moved:
 *
 *   none        — no prompt at all. The control.
 *   english     — today's production behaviour for every locale (the bug).
 *   translated  — a domain hint in the TARGET language. Tests whether a
 *                 same-language hint helps the way the English hint hurt.
 *   vocab       — the translated hint plus a literal list of this benchmark's
 *                 crop/input/scheme names in-script. Whisper's `prompt` is a
 *                 free-text style primer, not a hotword list, so stuffing exact
 *                 spellings into it is the only lever Groq's API exposes for
 *                 "please prefer this spelling" — worth measuring, not assumed.
 */

export const ENGLISH_PROMPT = "Indian farming: crops, soil, irrigation, mandi prices, weather.";

/** A domain hint in the farmer's own language, for the `translated` variant. */
export const LOCALE_PROMPT = {
  en: ENGLISH_PROMPT,
  hi: "भारतीय खेती: फसल, मिट्टी, सिंचाई, मंडी भाव, मौसम।",
  kn: "ಭಾರತೀಯ ಕೃಷಿ: ಬೆಳೆಗಳು, ಮಣ್ಣು, ನೀರಾವರಿ, ಮಂಡಿ ಬೆಲೆಗಳು, ಹವಾಮಾನ.",
  ta: "இந்திய விவசாயம்: பயிர்கள், மண், பாசனம், சந்தை விலைகள், வானிலை.",
  te: "భారతీయ వ్యవసాయం: పంటలు, నేల, నీటిపారుదల, మార్కెట్ ధరలు, వాతావరణం.",
  ml: "ഇന്ത്യൻ കൃഷി: വിളകൾ, മണ്ണ്, ജലസേചനം, മാർക്കറ്റ് വില, കാലാവസ്ഥ.",
  mr: "भारतीय शेती: पिके, माती, सिंचन, बाजारभाव, हवामान.",
  bn: "ভারতীয় কৃষি: ফসল, মাটি, সেচ, বাজার দর, আবহাওয়া.",
  pa: "ਭਾਰਤੀ ਖੇਤੀ: ਫਸਲਾਂ, ਮਿੱਟੀ, ਸਿੰਚਾਈ, ਮੰਡੀ ਭਾਅ, ਮੌਸਮ।",
};

/**
 * The exact entity spellings this benchmark's ground truth uses, comma-joined,
 * appended after the translated domain hint. Kept short — Whisper's prompt
 * competes with the audio for context budget, and a long list risks becoming
 * noise rather than a bias.
 */
export const LOCALE_VOCAB = {
  en: ["urea", "DAP", "potash", "paddy", "wheat", "tomato", "sugarcane", "PM KISAN"],
  hi: ["यूरिया", "डीएपी", "पोटाश", "धान", "गेहूं", "टमाटर", "गन्ना", "किसान"],
  kn: ["ಯೂರಿಯಾ", "ಡಿಎಪಿ", "ಪೊಟ್ಯಾಶ್", "ಭತ್ತ", "ಗೋಧಿ", "ಟೊಮೇಟೊ", "ಕಬ್ಬು", "ಕಿಸಾನ್"],
  ta: ["யூரியா", "டிஏபி", "பொட்டாஷ்", "நெல்", "கோதுமை", "தக்காளி", "கரும்பு", "கிசான்"],
  te: ["యూరియా", "డీఏపీ", "పొటాష్", "ధాన్యం", "గోధుమ", "టమాటా", "చెరకు", "కిసాన్"],
  ml: ["യൂറിയ", "ഡിഎപി", "പൊട്ടാഷ്", "നെല്ല്", "ഗോതമ്പ്", "തക്കാളി", "കരിമ്പ്", "കിസാൻ"],
  mr: ["युरिया", "डीएपी", "पोटॅश", "भात", "गहू", "टोमॅटो", "ऊस", "किसान"],
  bn: ["ইউরিয়া", "ডিএপি", "পটাশ", "ধান", "গম", "টমেটো", "আখ", "কিসান"],
  pa: ["ਯੂਰੀਆ", "ਡੀਏਪੀ", "ਪੋਟਾਸ਼", "ਝੋਨਾ", "ਕਣਕ", "ਟਮਾਟਰ", "ਗੰਨਾ", "ਕਿਸਾਨ"],
};

export function buildPrompt(locale, variant) {
  if (variant === "none") return null;
  if (variant === "english") return ENGLISH_PROMPT;
  if (variant === "translated") return LOCALE_PROMPT[locale] ?? null;
  if (variant === "vocab") {
    const base = LOCALE_PROMPT[locale] ?? "";
    const vocab = (LOCALE_VOCAB[locale] ?? []).join(", ");
    return vocab ? `${base} ${vocab}.` : base || null;
  }
  throw new Error(`unknown prompt variant: ${variant}`);
}

export const VARIANTS = ["none", "english", "translated", "vocab"];
