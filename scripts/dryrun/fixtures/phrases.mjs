/**
 * The multilingual accuracy corpus: 9 languages × 12 utterances × 4 classes.
 *
 * ⚠ GROUND TRUTH IS MACHINE-AUTHORED. These sentences were written by a model,
 * not by native speakers, and some phrasing will be stilted or regionally odd.
 * A benchmark with wrong ground truth is worse than no benchmark, so the design
 * limits the damage: **scoring keys on entity tokens, never on whole-sentence
 * match.** Whether a transcription is "correct" is decided by whether the
 * amount, the crop, the input name or the command word survived — those are the
 * spans the agent actually consumes, and they stay valid even where the
 * surrounding sentence is unnatural.
 *
 * Get a native speaker to review the `text` fields before quoting these numbers
 * anywhere external. The `keys` are safer: they are mostly single words with
 * obvious referents.
 *
 * Classes, chosen for what a farmer says to an agent that can act:
 *   money  — rupee amounts, quintals, acres. A mishearing here is a wrong
 *            ledger entry, and it is the one error a farmer who cannot read the
 *            screen will never catch.
 *   entity — crop names, fertiliser and pesticide names. Entity-dense
 *            agricultural vocabulary is where Indic ASR is documented to fail.
 *   command— short imperatives. A miss costs a wasted turn, not a wrong write.
 *   discursive — schemes, dates, symptom descriptions. Longer and looser.
 *
 * Each entry: [id, class, text, keys] where `keys` is a list of alternative
 * groups — the transcription passes a key if ANY form in that group appears
 * (edit-distance tolerant). Digits and number words are both accepted, because
 * Whisper normalises "two thousand" to "2,000".
 */

const e = (id, cls, text, keys) => ({ id, cls, text, keys });

export const CORPUS = {
  en: [
    e("M1", "money", "I bought urea for two thousand rupees", [["2000", "two thousand"], ["urea"]]),
    e("M2", "money", "I sold ten quintals of paddy", [["10", "ten"], ["quintal"], ["paddy", "rice"]]),
    e("M3", "money", "My farm is three acres", [["3", "three"], ["acre"]]),
    e("E1", "entity", "I sprayed DAP on the wheat", [["dap", "d a p"], ["wheat"]]),
    e("E2", "entity", "The tomato leaves have spots", [["tomato"], ["leaf", "leaves"]]),
    e("E3", "entity", "I need potash for the sugarcane", [["potash"], ["sugarcane", "sugar cane"]]),
    e("C1", "command", "Open the market prices", [["market"]]),
    e("C2", "command", "Show today's tasks", [["today"], ["task"]]),
    e("C3", "command", "Undo that", [["undo"]]),
    e("S1", "discursive", "Am I eligible for PM KISAN", [["kisan"]]),
    e("S2", "discursive", "I sowed on the fifteenth of June", [["15", "fifteen"], ["june"]]),
    e("S3", "discursive", "The lower leaves are turning yellow", [["yellow"], ["leaf", "leaves"]]),
  ],

  hi: [
    e("M1", "money", "मैंने दो हज़ार रुपये का यूरिया खरीदा", [["2000", "दो हज़ार", "दो हजार"], ["यूरिया"]]),
    e("M2", "money", "मैंने दस क्विंटल धान बेचा", [["10", "दस"], ["क्विंटल"], ["धान"]]),
    e("M3", "money", "मेरा खेत तीन एकड़ का है", [["3", "तीन"], ["एकड़"]]),
    e("E1", "entity", "मैंने गेहूं पर डीएपी छिड़का", [["डीएपी", "dap"], ["गेहूं", "गेहूँ"]]),
    e("E2", "entity", "टमाटर के पत्तों पर धब्बे हैं", [["टमाटर"], ["पत्त"]]),
    e("E3", "entity", "गन्ने के लिए पोटाश चाहिए", [["पोटाश"], ["गन्न"]]),
    e("C1", "command", "मंडी भाव खोलो", [["मंडी"]]),
    e("C2", "command", "आज के काम दिखाओ", [["आज"], ["काम"]]),
    e("C3", "command", "वापस करो", [["वापस"]]),
    e("S1", "discursive", "क्या मैं पीएम किसान के लिए पात्र हूं", [["किसान"]]),
    e("S2", "discursive", "मैंने पंद्रह जून को बुवाई की", [["15", "पंद्रह"], ["जून"]]),
    e("S3", "discursive", "नीचे के पत्ते पीले हो रहे हैं", [["पील"], ["पत्त"]]),
  ],

  kn: [
    e("M1", "money", "ನಾನು ಎರಡು ಸಾವಿರ ರೂಪಾಯಿ ಯೂರಿಯಾ ಖರೀದಿಸಿದೆ", [["2000", "ಎರಡು ಸಾವಿರ"], ["ಯೂರಿಯಾ"]]),
    e("M2", "money", "ನಾನು ಹತ್ತು ಕ್ವಿಂಟಾಲ್ ಭತ್ತ ಮಾರಿದೆ", [["10", "ಹತ್ತು"], ["ಕ್ವಿಂಟಾ"], ["ಭತ್ತ"]]),
    e("M3", "money", "ನನ್ನ ಹೊಲ ಮೂರು ಎಕರೆ", [["3", "ಮೂರು"], ["ಎಕರೆ"]]),
    e("E1", "entity", "ಗೋಧಿಗೆ ಡಿಎಪಿ ಸಿಂಪಡಿಸಿದೆ", [["ಡಿಎಪಿ", "dap"], ["ಗೋಧಿ"]]),
    e("E2", "entity", "ಟೊಮೇಟೊ ಎಲೆಗಳಲ್ಲಿ ಚುಕ್ಕೆಗಳಿವೆ", [["ಟೊಮೇಟೊ", "ಟೊಮ್ಯಾಟೊ"], ["ಎಲೆ"]]),
    e("E3", "entity", "ಕಬ್ಬಿಗೆ ಪೊಟ್ಯಾಶ್ ಬೇಕು", [["ಪೊಟ್ಯಾ"], ["ಕಬ್ಬ"]]),
    e("C1", "command", "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ತೆರೆ", [["ಮಾರುಕಟ್ಟೆ"]]),
    e("C2", "command", "ಇಂದಿನ ಕೆಲಸ ತೋರಿಸು", [["ಇಂದ"], ["ಕೆಲಸ"]]),
    e("C3", "command", "ಹಿಂದೆ ತೆಗೆದುಕೊ", [["ಹಿಂದೆ"]]),
    e("S1", "discursive", "ನಾನು ಪಿಎಂ ಕಿಸಾನ್ ಗೆ ಅರ್ಹನೇ", [["ಕಿಸಾನ"]]),
    e("S2", "discursive", "ಜೂನ್ ಹದಿನೈದಕ್ಕೆ ಬಿತ್ತನೆ ಮಾಡಿದೆ", [["15", "ಹದಿನೈದ"], ["ಜೂನ"]]),
    e("S3", "discursive", "ಕೆಳಗಿನ ಎಲೆಗಳು ಹಳದಿ ಆಗುತ್ತಿವೆ", [["ಹಳದಿ"], ["ಎಲೆ"]]),
  ],

  ta: [
    e("M1", "money", "நான் இரண்டாயிரம் ரூபாய்க்கு யூரியா வாங்கினேன்", [["2000", "இரண்டாயிரம்"], ["யூரியா"]]),
    e("M2", "money", "நான் பத்து குவிண்டால் நெல் விற்றேன்", [["10", "பத்து"], ["குவிண்டா"], ["நெல்"]]),
    e("M3", "money", "என் நிலம் மூன்று ஏக்கர்", [["3", "மூன்று"], ["ஏக்கர்"]]),
    e("E1", "entity", "கோதுமைக்கு டிஏபி தெளித்தேன்", [["டிஏபி", "dap"], ["கோதுமை"]]),
    e("E2", "entity", "தக்காளி இலைகளில் புள்ளிகள் உள்ளன", [["தக்காளி"], ["இலை"]]),
    e("E3", "entity", "கரும்புக்கு பொட்டாஷ் வேண்டும்", [["பொட்டா"], ["கரும்ப"]]),
    e("C1", "command", "சந்தை விலை திற", [["சந்தை"]]),
    e("C2", "command", "இன்றைய வேலைகளை காட்டு", [["இன்ற"], ["வேலை"]]),
    e("C3", "command", "திரும்பப் பெறு", [["திரும்ப"]]),
    e("S1", "discursive", "நான் பிஎம் கிசான் தகுதி உள்ளவனா", [["கிசான"]]),
    e("S2", "discursive", "ஜூன் பதினைந்தில் விதைத்தேன்", [["15", "பதினைந"], ["ஜூன்"]]),
    e("S3", "discursive", "கீழ் இலைகள் மஞ்சளாகின்றன", [["மஞ்சள"], ["இலை"]]),
  ],

  te: [
    e("M1", "money", "నేను రెండు వేల రూపాయల యూరియా కొన్నాను", [["2000", "రెండు వేల"], ["యూరియా"]]),
    e("M2", "money", "నేను పది క్వింటాళ్ల ధాన్యం అమ్మాను", [["10", "పది"], ["క్వింటా"], ["ధాన్యం"]]),
    e("M3", "money", "నా పొలం మూడు ఎకరాలు", [["3", "మూడు"], ["ఎకర"]]),
    e("E1", "entity", "గోధుమకు డీఏపీ చల్లాను", [["డీఏపీ", "dap"], ["గోధుమ"]]),
    e("E2", "entity", "టమాటా ఆకులపై మచ్చలు ఉన్నాయి", [["టమాటా", "టొమాటో"], ["ఆకు"]]),
    e("E3", "entity", "చెరకుకు పొటాష్ కావాలి", [["పొటా"], ["చెరకు"]]),
    e("C1", "command", "మార్కెట్ ధరలు తెరువు", [["మార్కెట"]]),
    e("C2", "command", "ఈరోజు పనులు చూపించు", [["ఈరోజు", "ఇరోజు"], ["పను"]]),
    e("C3", "command", "వెనక్కి తీసుకో", [["వెనక్క"]]),
    e("S1", "discursive", "నేను పీఎం కిసాన్ కు అర్హుడనా", [["కిసాన"]]),
    e("S2", "discursive", "జూన్ పదిహేనున విత్తనం వేశాను", [["15", "పదిహేను"], ["జూన"]]),
    e("S3", "discursive", "కింది ఆకులు పసుపు రంగులోకి మారుతున్నాయి", [["పసుపు"], ["ఆకు"]]),
  ],

  ml: [
    e("M1", "money", "ഞാൻ രണ്ടായിരം രൂപയുടെ യൂറിയ വാങ്ങി", [["2000", "രണ്ടായിരം"], ["യൂറിയ"]]),
    e("M2", "money", "ഞാൻ പത്ത് ക്വിന്റൽ നെല്ല് വിറ്റു", [["10", "പത്ത"], ["ക്വിന്റ"], ["നെല്ല"]]),
    e("M3", "money", "എന്റെ കൃഷിയിടം മൂന്ന് ഏക്കർ", [["3", "മൂന്ന"], ["ഏക്കർ"]]),
    e("E1", "entity", "ഗോതമ്പിന് ഡിഎപി തളിച്ചു", [["ഡിഎപി", "dap"], ["ഗോതമ്പ"]]),
    e("E2", "entity", "തക്കാളി ഇലകളിൽ പുള്ളികളുണ്ട്", [["തക്കാളി"], ["ഇല"]]),
    e("E3", "entity", "കരിമ്പിന് പൊട്ടാഷ് വേണം", [["പൊട്ടാ"], ["കരിമ്പ"]]),
    e("C1", "command", "മാർക്കറ്റ് വില തുറക്കുക", [["മാർക്കറ"]]),
    e("C2", "command", "ഇന്നത്തെ ജോലികൾ കാണിക്കുക", [["ഇന്ന"], ["ജോലി"]]),
    e("C3", "command", "പഴയപടിയാക്കുക", [["പഴയപടി"]]),
    e("S1", "discursive", "എനിക്ക് പിഎം കിസാൻ അർഹതയുണ്ടോ", [["കിസാ"]]),
    e("S2", "discursive", "ജൂൺ പതിനഞ്ചിന് വിതച്ചു", [["15", "പതിനഞ്ച"], ["ജൂൺ", "ജൂണ"]]),
    e("S3", "discursive", "താഴത്തെ ഇലകൾ മഞ്ഞയാകുന്നു", [["മഞ്ഞ"], ["ഇല"]]),
  ],

  mr: [
    e("M1", "money", "मी दोन हजार रुपयांचे युरिया घेतले", [["2000", "दोन हजार"], ["युरिया", "यूरिया"]]),
    e("M2", "money", "मी दहा क्विंटल भात विकले", [["10", "दहा"], ["क्विंटल"], ["भात"]]),
    e("M3", "money", "माझे शेत तीन एकर आहे", [["3", "तीन"], ["एकर"]]),
    e("E1", "entity", "गव्हावर डीएपी फवारले", [["डीएपी", "dap"], ["गव्ह", "गह"]]),
    e("E2", "entity", "टोमॅटोच्या पानांवर डाग आहेत", [["टोमॅटो", "टोमाटो"], ["पान"]]),
    e("E3", "entity", "उसासाठी पोटॅश हवे", [["पोटॅ", "पोटा"], ["उस", "ऊस"]]),
    e("C1", "command", "बाजारभाव उघडा", [["बाजार"]]),
    e("C2", "command", "आजची कामे दाखवा", [["आज"], ["काम"]]),
    e("C3", "command", "मागे घ्या", [["मागे"]]),
    e("S1", "discursive", "मी पीएम किसानसाठी पात्र आहे का", [["किसान"]]),
    e("S2", "discursive", "मी पंधरा जूनला पेरणी केली", [["15", "पंधरा"], ["जून"]]),
    e("S3", "discursive", "खालची पाने पिवळी होत आहेत", [["पिवळ"], ["पान"]]),
  ],

  bn: [
    e("M1", "money", "আমি দুই হাজার টাকার ইউরিয়া কিনেছি", [["2000", "দুই হাজার"], ["ইউরিয়া"]]),
    e("M2", "money", "আমি দশ কুইন্টাল ধান বিক্রি করেছি", [["10", "দশ"], ["কুইন্ট"], ["ধান"]]),
    e("M3", "money", "আমার জমি তিন একর", [["3", "তিন"], ["একর"]]),
    e("E1", "entity", "গমে ডিএপি ছিটিয়েছি", [["ডিএপি", "dap"], ["গম"]]),
    e("E2", "entity", "টমেটোর পাতায় দাগ আছে", [["টমেটো"], ["পাত"]]),
    e("E3", "entity", "আখের জন্য পটাশ দরকার", [["পটা"], ["আখ"]]),
    e("C1", "command", "বাজার দর খোলো", [["বাজার"]]),
    e("C2", "command", "আজকের কাজ দেখাও", [["আজ"], ["কাজ"]]),
    e("C3", "command", "ফিরিয়ে নাও", [["ফিরি"]]),
    e("S1", "discursive", "আমি কি পিএম কিসানের যোগ্য", [["কিসান"]]),
    e("S2", "discursive", "আমি পনেরো জুন বীজ বুনেছি", [["15", "পনের"], ["জুন"]]),
    e("S3", "discursive", "নিচের পাতা হলুদ হয়ে যাচ্ছে", [["হলুদ"], ["পাত"]]),
  ],

  pa: [
    e("M1", "money", "ਮੈਂ ਦੋ ਹਜ਼ਾਰ ਰੁਪਏ ਦਾ ਯੂਰੀਆ ਖਰੀਦਿਆ", [["2000", "ਦੋ ਹਜ਼ਾਰ", "ਦੋ ਹਜਾਰ"], ["ਯੂਰੀਆ"]]),
    e("M2", "money", "ਮੈਂ ਦਸ ਕੁਇੰਟਲ ਝੋਨਾ ਵੇਚਿਆ", [["10", "ਦਸ"], ["ਕੁਇੰਟ"], ["ਝੋਨ"]]),
    e("M3", "money", "ਮੇਰਾ ਖੇਤ ਤਿੰਨ ਏਕੜ ਹੈ", [["3", "ਤਿੰਨ"], ["ਏਕੜ"]]),
    e("E1", "entity", "ਕਣਕ ਉੱਤੇ ਡੀਏਪੀ ਛਿੜਕਿਆ", [["ਡੀਏਪੀ", "dap"], ["ਕਣਕ"]]),
    e("E2", "entity", "ਟਮਾਟਰ ਦੇ ਪੱਤਿਆਂ ਉੱਤੇ ਧੱਬੇ ਹਨ", [["ਟਮਾਟਰ"], ["ਪੱਤ"]]),
    e("E3", "entity", "ਗੰਨੇ ਲਈ ਪੋਟਾਸ਼ ਚਾਹੀਦਾ", [["ਪੋਟਾ"], ["ਗੰਨ"]]),
    e("C1", "command", "ਮੰਡੀ ਭਾਅ ਖੋਲ੍ਹੋ", [["ਮੰਡੀ"]]),
    e("C2", "command", "ਅੱਜ ਦੇ ਕੰਮ ਦਿਖਾਓ", [["ਅੱਜ", "ਅਜ"], ["ਕੰਮ"]]),
    e("C3", "command", "ਵਾਪਸ ਕਰੋ", [["ਵਾਪਸ"]]),
    e("S1", "discursive", "ਕੀ ਮੈਂ ਪੀਐਮ ਕਿਸਾਨ ਲਈ ਯੋਗ ਹਾਂ", [["ਕਿਸਾਨ"]]),
    e("S2", "discursive", "ਮੈਂ ਪੰਦਰਾਂ ਜੂਨ ਨੂੰ ਬੀਜਿਆ", [["15", "ਪੰਦਰਾ"], ["ਜੂਨ"]]),
    e("S3", "discursive", "ਹੇਠਲੇ ਪੱਤੇ ਪੀਲੇ ਹੋ ਰਹੇ ਹਨ", [["ਪੀਲ"], ["ਪੱਤ"]]),
  ],
};

export const CLASSES = ["money", "entity", "command", "discursive"];
export const LOCALES = Object.keys(CORPUS);
