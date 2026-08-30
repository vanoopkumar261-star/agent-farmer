import type { Locale } from "./config";

type Dict = Record<string, string>;

/* ────────────────────────────────────────────────────────────────────────────
   Team page copy, namespaced under `team.*`. English is the source of truth;
   missing keys fall back to English automatically. Non-English copy is a
   first-pass machine translation — recommend a native review before a
   public launch.
   ──────────────────────────────────────────────────────────────────────────── */

const en: Dict = {
  "team.member.anoopkumar.role": "Team Lead · LLM Developer & 3-D Designer",
  "team.member.anoopkumar.desc": "Never settle.",
  "team.member.barsha.role": "Content Researcher & Tester",
  "team.member.barsha.desc": "Curious mind exploring AI and software to solve real-world challenges. Thriving on innovation, teamwork, and continuous learning.",
  "team.member.manan.role": "Database Manager & Backend Developer",
  "team.member.manan.desc": "Gamble with the knowledge or be poor.",
  "team.member.sahajtha.role": "UI Designer & Curator",
  "team.member.sahajtha.desc": "Fueled by creativity and curiosity. Building skills, chasing ideas, and enjoying the process.",
  "team.member.shiven.role": "i18n Architect & Designer",
  "team.member.shiven.desc": "Working with passion.",
};

const hi: Dict = {
  "team.member.anoopkumar.role": "टीम लीड · एलएलएम डेवलपर और 3-डी डिज़ाइनर",
  "team.member.anoopkumar.desc": "कभी समझौता मत करो।",
  "team.member.barsha.role": "कंटेंट रिसर्चर और टेस्टर",
  "team.member.barsha.desc": "वास्तविक दुनिया की चुनौतियों को हल करने के लिए AI और सॉफ़्टवेयर की खोज करने वाला जिज्ञासु मन। नवाचार, टीमवर्क और निरंतर सीखने से प्रेरित।",
  "team.member.manan.role": "डेटाबेस मैनेजर और बैकएंड डेवलपर",
  "team.member.manan.desc": "ज्ञान के साथ जोखिम उठाओ, या गरीब बने रहो।",
  "team.member.sahajtha.role": "यूआई डिज़ाइनर और क्यूरेटर",
  "team.member.sahajtha.desc": "रचनात्मकता और जिज्ञासा से प्रेरित। कौशल बनाना, विचारों का पीछा करना, और प्रक्रिया का आनंद लेना।",
  "team.member.shiven.role": "i18n आर्किटेक्ट और डिज़ाइनर",
  "team.member.shiven.desc": "जुनून के साथ काम करना।",
};

const kn: Dict = {
  "team.member.anoopkumar.role": "ತಂಡದ ಮುಖಂಡ · ಎಲ್‌ಎಲ್‌ಎಂ ಡೆವಲಪರ್ ಮತ್ತು 3-ಡಿ ಡಿಸೈನರ್",
  "team.member.anoopkumar.desc": "ಎಂದಿಗೂ ರಾಜಿ ಮಾಡಿಕೊಳ್ಳಬೇಡಿ.",
  "team.member.barsha.role": "ಕಂಟೆಂಟ್ ರಿಸರ್ಚರ್ ಮತ್ತು ಟೆಸ್ಟರ್",
  "team.member.barsha.desc": "ನೈಜ ಪ್ರಪಂಚದ ಸವಾಲುಗಳನ್ನು ಪರಿಹರಿಸಲು AI ಮತ್ತು ಸಾಫ್ಟ್‌ವೇರ್ ಅನ್ನು ಅನ್ವೇಷಿಸುವ ಕುತೂಹಲಿ ಮನಸ್ಸು. ನಾವೀನ್ಯತೆ, ತಂಡಕಾರ್ಯ ಮತ್ತು ನಿರಂತರ ಕಲಿಕೆಯಿಂದ ಪ್ರೇರಿತ.",
  "team.member.manan.role": "ಡೇಟಾಬೇಸ್ ಮ್ಯಾನೇಜರ್ ಮತ್ತು ಬ್ಯಾಕೆಂಡ್ ಡೆವಲಪರ್",
  "team.member.manan.desc": "ಜ್ಞಾನದೊಂದಿಗೆ ಜೂಜಾಡು, ಇಲ್ಲದಿದ್ದರೆ ಬಡವನಾಗಿರು.",
  "team.member.sahajtha.role": "ಯುಐ ಡಿಸೈನರ್ ಮತ್ತು ಕ್ಯುರೇಟರ್",
  "team.member.sahajtha.desc": "ಸೃಜನಶೀಲತೆ ಮತ್ತು ಕುತೂಹಲದಿಂದ ಪ್ರೇರಿತ. ಕೌಶಲ್ಯಗಳನ್ನು ನಿರ್ಮಿಸುವುದು, ಆಲೋಚನೆಗಳನ್ನು ಬೆನ್ನಟ್ಟುವುದು ಮತ್ತು ಪ್ರಕ್ರಿಯೆಯನ್ನು ಆನಂದಿಸುವುದು.",
  "team.member.shiven.role": "i18n ಆರ್ಕಿಟೆಕ್ಟ್ ಮತ್ತು ಡಿಸೈನರ್",
  "team.member.shiven.desc": "ಉತ್ಸಾಹದಿಂದ ಕೆಲಸ ಮಾಡುವುದು.",
};

const ta: Dict = {
  "team.member.anoopkumar.role": "குழுத் தலைவர் · LLM டெவலப்பர் & 3-டி டிசைனர்",
  "team.member.anoopkumar.desc": "ஒருபோதும் சமரசம் செய்யாதே.",
  "team.member.barsha.role": "உள்ளடக்க ஆய்வாளர் & சோதனையாளர்",
  "team.member.barsha.desc": "நிஜ உலக சவால்களைத் தீர்க்க AI மற்றும் மென்பொருளை ஆராயும் ஆர்வமுள்ள மனம். புதுமை, குழுப்பணி மற்றும் தொடர் கற்றலால் உந்தப்படுகிறார்.",
  "team.member.manan.role": "தரவுத்தள மேலாளர் & பேக்எண்ட் டெவலப்பர்",
  "team.member.manan.desc": "அறிவுடன் சூதாடு, இல்லையேல் ஏழையாக இரு.",
  "team.member.sahajtha.role": "UI டிசைனர் & க்யூரேட்டர்",
  "team.member.sahajtha.desc": "படைப்பாற்றல் மற்றும் ஆர்வத்தால் உந்தப்படுகிறார். திறன்களை வளர்த்தல், யோசனைகளைத் துரத்துதல், செயல்முறையை அனுபவித்தல்.",
  "team.member.shiven.role": "i18n கட்டமைப்பாளர் & டிசைனர்",
  "team.member.shiven.desc": "ஆர்வத்துடன் பணியாற்றுதல்.",
};

const te: Dict = {
  "team.member.anoopkumar.role": "టీమ్ లీడ్ · LLM డెవలపర్ & 3-డి డిజైనర్",
  "team.member.anoopkumar.desc": "ఎప్పుడూ రాజీ పడకు.",
  "team.member.barsha.role": "కంటెంట్ రీసెర్చర్ & టెస్టర్",
  "team.member.barsha.desc": "నిజ ప్రపంచ సవాళ్లను పరిష్కరించడానికి AI మరియు సాఫ్ట్‌వేర్‌ను అన్వేషించే ఉత్సుకత గల మనసు. ఆవిష్కరణ, టీమ్‌వర్క్ మరియు నిరంతర అభ్యాసంతో ముందుకు సాగుతుంది.",
  "team.member.manan.role": "డేటాబేస్ మేనేజర్ & బ్యాకెండ్ డెవలపర్",
  "team.member.manan.desc": "జ్ఞానంతో పందెం వేయి, లేదా పేదవాడిగా ఉండు.",
  "team.member.sahajtha.role": "UI డిజైనర్ & క్యూరేటర్",
  "team.member.sahajtha.desc": "సృజనాత్మకత మరియు ఉత్సుకతతో ముందుకు సాగుతుంది. నైపుణ్యాలను పెంచుకోవడం, ఆలోచనలను వెంబడించడం, ప్రక్రియను ఆస్వాదించడం.",
  "team.member.shiven.role": "i18n ఆర్కిటెక్ట్ & డిజైనర్",
  "team.member.shiven.desc": "అభిరుచితో పనిచేయడం.",
};

const ml: Dict = {
  "team.member.anoopkumar.role": "ടീം ലീഡ് · എൽഎൽഎം ഡെവലപ്പർ & 3-ഡി ഡിസൈനർ",
  "team.member.anoopkumar.desc": "ഒരിക്കലും വിട്ടുവീഴ്ച ചെയ്യരുത്.",
  "team.member.barsha.role": "കണ്ടന്റ് റിസർച്ചർ & ടെസ്റ്റർ",
  "team.member.barsha.desc": "യഥാർത്ഥ ലോക വെല്ലുവിളികൾ പരിഹരിക്കാൻ AI-യും സോഫ്റ്റ്‌വെയറും പര്യവേക്ഷണം ചെയ്യുന്ന ജിജ്ഞാസുവായ മനസ്സ്. നൂതനത്വം, ടീം വർക്ക്, തുടർച്ചയായ പഠനം എന്നിവയാൽ പ്രചോദിതം.",
  "team.member.manan.role": "ഡാറ്റാബേസ് മാനേജർ & ബാക്കെൻഡ് ഡെവലപ്പർ",
  "team.member.manan.desc": "അറിവുകൊണ്ട് വാതുവെക്കുക, അല്ലെങ്കിൽ ദരിദ്രനായി തുടരുക.",
  "team.member.sahajtha.role": "UI ഡിസൈനർ & ക്യൂറേറ്റർ",
  "team.member.sahajtha.desc": "സർഗ്ഗാത്മകതയും ജിജ്ഞാസയും കൊണ്ട് പ്രചോദിതം. കഴിവുകൾ വളർത്തുക, ആശയങ്ങൾ പിന്തുടരുക, പ്രക്രിയ ആസ്വദിക്കുക.",
  "team.member.shiven.role": "i18n ആർക്കിടെക്റ്റ് & ഡിസൈനർ",
  "team.member.shiven.desc": "അഭിനിവേശത്തോടെ പ്രവർത്തിക്കുന്നു.",
};

const mr: Dict = {
  "team.member.anoopkumar.role": "टीम लीड · एलएलएम डेव्हलपर आणि 3-डी डिझायनर",
  "team.member.anoopkumar.desc": "कधीही तडजोड करू नका.",
  "team.member.barsha.role": "कंटेंट रिसर्चर आणि टेस्टर",
  "team.member.barsha.desc": "वास्तविक जगातील आव्हाने सोडवण्यासाठी AI आणि सॉफ्टवेअरचा शोध घेणारे जिज्ञासू मन. नाविन्य, टीमवर्क आणि सतत शिकण्याने प्रेरित.",
  "team.member.manan.role": "डेटाबेस मॅनेजर आणि बॅकएंड डेव्हलपर",
  "team.member.manan.desc": "ज्ञानासह जुगार खेळा, नाहीतर गरीब रहा.",
  "team.member.sahajtha.role": "यूआय डिझायनर आणि क्युरेटर",
  "team.member.sahajtha.desc": "सर्जनशीलता आणि जिज्ञासेने प्रेरित. कौशल्ये घडवणे, कल्पनांचा पाठलाग करणे आणि प्रक्रियेचा आनंद घेणे.",
  "team.member.shiven.role": "i18n आर्किटेक्ट आणि डिझायनर",
  "team.member.shiven.desc": "उत्कटतेने काम करणे.",
};

const bn: Dict = {
  "team.member.anoopkumar.role": "টিম লিড · এলএলএম ডেভেলপার এবং 3-ডি ডিজাইনার",
  "team.member.anoopkumar.desc": "কখনো আপস করো না।",
  "team.member.barsha.role": "কনটেন্ট রিসার্চার এবং টেস্টার",
  "team.member.barsha.desc": "বাস্তব-জগতের চ্যালেঞ্জ সমাধানে AI এবং সফটওয়্যার অন্বেষণকারী কৌতূহলী মন। উদ্ভাবন, টিমওয়ার্ক এবং ক্রমাগত শেখার দ্বারা অনুপ্রাণিত।",
  "team.member.manan.role": "ডেটাবেস ম্যানেজার এবং ব্যাকএন্ড ডেভেলপার",
  "team.member.manan.desc": "জ্ঞান নিয়ে জুয়া খেলো, নয়তো দরিদ্র থেকো।",
  "team.member.sahajtha.role": "ইউআই ডিজাইনার এবং কিউরেটর",
  "team.member.sahajtha.desc": "সৃজনশীলতা ও কৌতূহল দ্বারা চালিত। দক্ষতা গড়ে তোলা, ধারণার পিছনে ছোটা, এবং প্রক্রিয়াটি উপভোগ করা।",
  "team.member.shiven.role": "i18n আর্কিটেক্ট এবং ডিজাইনার",
  "team.member.shiven.desc": "আবেগ নিয়ে কাজ করা।",
};

const pa: Dict = {
  "team.member.anoopkumar.role": "ਟੀਮ ਲੀਡ · ਐਲਐਲਐਮ ਡਿਵੈਲਪਰ ਅਤੇ 3-ਡੀ ਡਿਜ਼ਾਈਨਰ",
  "team.member.anoopkumar.desc": "ਕਦੇ ਸਮਝੌਤਾ ਨਾ ਕਰੋ।",
  "team.member.barsha.role": "ਕੰਟੈਂਟ ਰਿਸਰਚਰ ਅਤੇ ਟੈਸਟਰ",
  "team.member.barsha.desc": "ਅਸਲ-ਦੁਨੀਆ ਦੀਆਂ ਚੁਣੌਤੀਆਂ ਹੱਲ ਕਰਨ ਲਈ AI ਅਤੇ ਸਾਫਟਵੇਅਰ ਦੀ ਖੋਜ ਕਰਨ ਵਾਲਾ ਉਤਸੁਕ ਮਨ। ਨਵੀਨਤਾ, ਟੀਮਵਰਕ ਅਤੇ ਲਗਾਤਾਰ ਸਿੱਖਣ ਨਾਲ ਪ੍ਰੇਰਿਤ।",
  "team.member.manan.role": "ਡਾਟਾਬੇਸ ਮੈਨੇਜਰ ਅਤੇ ਬੈਕਐਂਡ ਡਿਵੈਲਪਰ",
  "team.member.manan.desc": "ਗਿਆਨ ਨਾਲ ਜੂਆ ਖੇਡੋ, ਨਹੀਂ ਤਾਂ ਗਰੀਬ ਰਹੋ।",
  "team.member.sahajtha.role": "ਯੂਆਈ ਡਿਜ਼ਾਈਨਰ ਅਤੇ ਕਿਊਰੇਟਰ",
  "team.member.sahajtha.desc": "ਰਚਨਾਤਮਕਤਾ ਅਤੇ ਉਤਸੁਕਤਾ ਨਾਲ ਪ੍ਰੇਰਿਤ। ਹੁਨਰ ਬਣਾਉਣਾ, ਵਿਚਾਰਾਂ ਦਾ ਪਿੱਛਾ ਕਰਨਾ, ਅਤੇ ਪ੍ਰਕਿਰਿਆ ਦਾ ਆਨੰਦ ਲੈਣਾ।",
  "team.member.shiven.role": "i18n ਆਰਕੀਟੈਕਟ ਅਤੇ ਡਿਜ਼ਾਈਨਰ",
  "team.member.shiven.desc": "ਜਨੂੰਨ ਨਾਲ ਕੰਮ ਕਰਨਾ।",
};

export const TEAM: Record<Locale, Dict> = { en, hi, kn, ta, te, ml, mr, bn, pa };
