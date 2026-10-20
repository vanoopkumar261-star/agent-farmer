import type { Locale } from "./config";

/**
 * Text produced at runtime rather than written into a page: agronomy tasks,
 * farm-health factors, weather alerts, and the data words inside them.
 *
 * `term.*` keys localize a single English data word — a crop name from the
 * database, a growth stage, a weather label or weekday. `translate` applies
 * them to string params automatically, and <Term> to standalone words; the
 * key is the lowercased English word. English needs no `term.*` entries.
 */

type Dict = Record<string, string>;

const en: Dict = {
  // ── Daily tasks (src/lib/agronomy.ts) ──
  "task.inspectGermination": "Inspect {crop} germination — Farm {fi}",
  "task.standingWater": "Maintain shallow standing water — Farm {fi}",
  "task.nitrogen": "Apply nitrogen top-dressing to {crop} — Farm {fi}",
  "task.weeds": "Check for weeds around {crop} — Farm {fi}",
  "task.scoutFlowering": "Scout {crop} for pests & disease at flowering — Farm {fi}",
  "task.prepareHarvest": "Prepare for {crop} harvest — Farm {fi}",
  "task.inspectLeaves": "Inspect leaves for early signs of disease",
  "task.soilMoisture": "Check soil moisture — Farm {fi}",
  "task.holdIrrigation": "Hold irrigation & spraying — rain expected",
  "task.irrigateEarly": "Irrigate early morning — heat stress risk",
  "task.meta.day": "Day {day} · {stage} stage",
  "task.meta.dayWeeds": "Day {day} · {stage} stage · weeds compete hardest now",
  "task.meta.dayWaterStress": "Day {day} · {stage} stage · avoid water stress now",
  "task.meta.keepMoist": "{crop} · keep the field moist at establishment",
  "task.meta.harvest": "~{days} days to harvest · arrange labour & drying",
  "task.meta.cropFarm": "{crop} · Farm {fi}",
  "task.meta.rainFed": "Rain-fed plot · no rain forecast",
  "task.meta.weather72": "Weather · next 72 hours",
  "task.meta.heat": "{temp}°C · protect crops at a sensitive stage",

  // ── Farm health (src/lib/health.ts) ──
  "health.heat": "Heat stress risk — {crop} at {stage}",
  "health.rainHarvest": "Rain forecast during a harvest window",
  "health.rainOps": "Rain forecast — field operations constrained",
  "health.frost": "Cold/frost risk in the forecast",
  "health.weatherSyncing": "Weather data syncing",
  "health.noRainThirsty": "No rain forecast — {crop} is rain-fed and thirsty",
  "health.diseaseOne": "{n} recent scan found disease",
  "health.diseaseMany": "{n} recent scans found disease",
  "health.missedOne": "{n} task missed yesterday",
  "health.missedMany": "{n} tasks missed yesterday",
  "health.allClear": "No heat, rain, frost or disease risk detected",
  "health.note.noCrops": "No crops seeded yet — register a crop to start health tracking.",
  "health.note.good": "Your farms are in great shape.",
  "health.note.watch": "Healthy, with a few items to watch.",
  "health.note.risk": "Needs attention — check alerts.",

  // ── Alerts (src/lib/alerts.ts) ──
  "alert.missed.titleOne": "{missed} of {total} task missed yesterday",
  "alert.missed.titleMany": "{missed} of {total} tasks missed yesterday",
  "alert.missed.body":
    "You completed {done} of {total}. Yesterday's work doesn't carry over — make sure today's list is finished before the day ends.",
  "alert.rainHarvest.title": "Rain during harvest window",
  "alert.rainHarvest.body":
    "Rain is likely within 3 days while {crop} (Farm {fi}) is maturing — plan harvest and drying, and clear field drainage.",
  "alert.rain.title": "Rain likely in the next 3 days",
  "alert.rain.body": "Hold spraying and scheduled irrigation, and ensure field drainage is clear.",
  "alert.heat.title": "Heat stress risk — {crop}",
  "alert.heat.body":
    "Current {temp}°C at the {stage} stage (Farm {fi}). Irrigate early morning to protect yield.",
  "alert.frost.title": "Cold / frost risk",
  "alert.frost.body":
    "Night temperatures near freezing are in the forecast — protect sensitive crops and avoid night irrigation.",

  // ── Irrigation tasks & alerts (src/lib/irrigation.ts) ──
  "irrigation.task.irrigate": "Irrigate {crop} — Farm {fi}",
  "irrigation.task.irrigateMeta": "{mm} mm · {litres} L · about {hours}",
  "irrigation.task.conserve": "Conserve soil moisture — Farm {fi}",
  "irrigation.task.conserveMeta": "Rain-fed · {crop} below its comfort point",
  "irrigation.task.drain": "Check drainage — Farm {fi}",
  "irrigation.task.drainMeta": "Soil is at capacity with more water due",
  "irrigation.alert.wilting": "Farm {fi} is close to wilting point",
  "irrigation.alert.wiltingRainfed":
    "{crop} has used nearly all the water the soil can give, and there is no irrigation to fall back on. Mulch what you can and avoid disturbing the soil.",
  "irrigation.alert.wiltingIrrigated":
    "{crop} has used nearly all the available soil water. Irrigate today — about {mm} mm.",
  "irrigation.alert.overfull": "Farm {fi} has more water than it can hold",
  "irrigation.alert.overfullBody":
    "The root zone is already full and more is on the way. Hold irrigation and make sure the field can drain — waterlogged roots lose yield as surely as dry ones.",
  "irrigation.alert.dryFlowering": "Farm {fi} is dry at flowering",
  "irrigation.alert.dryFloweringBody":
    "{crop} is flowering on a rain-fed plot and is below its comfort point. Water stress now costs more yield than at any other stage.",

  // ── Analytics chart labels ──
  "analyticsCard.tipSeason": "{v}% grown · {stage} · {days}d to harvest",
  "analyticsCard.seriesProgress": "Progress",
  "analyticsCard.heatLimit": "heat limit {n}°",
  "analyticsCard.seriesRain": "Rain chance",
  "analyticsCard.seriesHigh": "High",
  "analyticsCard.seriesLow": "Low",
  "analyticsCard.seriesIncome": "Income",
  "analyticsCard.seriesExpense": "Expense",

  // ── AI weekly outlook ──
  "forecastCard.title": "This Week's Outlook",
  "forecastCard.subtitle": "AI forecast, from your live farm data",
  "forecastCard.refresh": "Refresh forecast",
  "forecastCard.irrigationRisk": "Irrigation risk",
  "forecastCard.diseaseRisk": "Disease/pest risk",

  // ── Hazard warnings ──
  "hazardCheck.original": "Original warning, as issued (English)",

  // ── Market board ──
  "marketBoard.demandHigh": "High demand",
  "marketBoard.demandMedium": "Medium demand",
  "marketBoard.demandLow": "Low demand",
  "marketAdvice.action.Sell now": "Sell now",
  "marketAdvice.action.Hold": "Hold",
  "marketAdvice.action.Wait": "Wait",
};

const hi: Dict = {
  "task.inspectGermination": "{crop} के अंकुरण की जाँच करें — खेत {fi}",
  "task.standingWater": "खेत में हल्का पानी भरा रखें — खेत {fi}",
  "task.nitrogen": "{crop} में नाइट्रोजन की ऊपरी खाद डालें — खेत {fi}",
  "task.weeds": "{crop} के आसपास खरपतवार देखें — खेत {fi}",
  "task.scoutFlowering": "फूल आने पर {crop} में कीट और रोग देखें — खेत {fi}",
  "task.prepareHarvest": "{crop} की कटाई की तैयारी करें — खेत {fi}",
  "task.inspectLeaves": "रोग के शुरुआती लक्षणों के लिए पत्तियाँ जाँचें",
  "task.soilMoisture": "मिट्टी की नमी जाँचें — खेत {fi}",
  "task.holdIrrigation": "सिंचाई और छिड़काव रोकें — बारिश की संभावना",
  "task.irrigateEarly": "सुबह जल्दी सिंचाई करें — गर्मी से तनाव का खतरा",
  "task.meta.day": "दिन {day} · {stage} अवस्था",
  "task.meta.dayWeeds": "दिन {day} · {stage} अवस्था · अभी खरपतवार सबसे ज़्यादा नुकसान करते हैं",
  "task.meta.dayWaterStress": "दिन {day} · {stage} अवस्था · अभी पानी की कमी न होने दें",
  "task.meta.keepMoist": "{crop} · जमाव के समय खेत में नमी बनाए रखें",
  "task.meta.harvest": "कटाई में ~{days} दिन · मज़दूर और सुखाने की व्यवस्था करें",
  "task.meta.cropFarm": "{crop} · खेत {fi}",
  "task.meta.rainFed": "बारानी खेत · बारिश का पूर्वानुमान नहीं",
  "task.meta.weather72": "मौसम · अगले 72 घंटे",
  "task.meta.heat": "{temp}°C · संवेदनशील अवस्था में फसल को बचाएँ",

  "health.heat": "गर्मी से तनाव का खतरा — {crop}, {stage} अवस्था में",
  "health.rainHarvest": "कटाई के समय बारिश का पूर्वानुमान",
  "health.rainOps": "बारिश का पूर्वानुमान — खेत के काम सीमित",
  "health.frost": "पूर्वानुमान में ठंड/पाले का खतरा",
  "health.weatherSyncing": "मौसम डेटा सिंक हो रहा है",
  "health.noRainThirsty": "बारिश का पूर्वानुमान नहीं — {crop} बारानी है और उसे पानी चाहिए",
  "health.diseaseOne": "हाल के {n} स्कैन में रोग मिला",
  "health.diseaseMany": "हाल के {n} स्कैन में रोग मिला",
  "health.missedOne": "कल {n} कार्य छूट गया",
  "health.missedMany": "कल {n} कार्य छूट गए",
  "health.allClear": "गर्मी, बारिश, पाले या रोग का कोई खतरा नहीं मिला",
  "health.note.noCrops": "अभी कोई फसल नहीं बोई गई — स्वास्थ्य ट्रैकिंग शुरू करने के लिए फसल दर्ज करें।",
  "health.note.good": "आपके खेत बहुत अच्छी स्थिति में हैं।",
  "health.note.watch": "स्वस्थ हैं, कुछ बातों पर ध्यान रखें।",
  "health.note.risk": "ध्यान देने की ज़रूरत है — अलर्ट देखें।",

  "alert.missed.titleOne": "कल {total} में से {missed} कार्य छूट गया",
  "alert.missed.titleMany": "कल {total} में से {missed} कार्य छूट गए",
  "alert.missed.body":
    "आपने {total} में से {done} कार्य पूरे किए। कल का काम आगे नहीं जुड़ता — दिन खत्म होने से पहले आज की सूची पूरी करें।",
  "alert.rainHarvest.title": "कटाई के समय बारिश",
  "alert.rainHarvest.body":
    "3 दिनों में बारिश की संभावना है और {crop} (खेत {fi}) पक रहा है — कटाई और सुखाने की योजना बनाएँ, और खेत की जल-निकासी साफ़ रखें।",
  "alert.rain.title": "अगले 3 दिनों में बारिश की संभावना",
  "alert.rain.body": "छिड़काव और तय सिंचाई रोकें, और खेत की जल-निकासी साफ़ रखें।",
  "alert.heat.title": "गर्मी से तनाव का खतरा — {crop}",
  "alert.heat.body":
    "अभी {temp}°C है और फसल {stage} अवस्था में है (खेत {fi})। उपज बचाने के लिए सुबह जल्दी सिंचाई करें।",
  "alert.frost.title": "ठंड / पाले का खतरा",
  "alert.frost.body":
    "पूर्वानुमान में रात का तापमान जमाव के करीब है — संवेदनशील फसलों को बचाएँ और रात में सिंचाई न करें।",

  "irrigation.task.irrigate": "{crop} की सिंचाई करें — खेत {fi}",
  "irrigation.task.irrigateMeta": "{mm} मिमी · {litres} लीटर · लगभग {hours}",
  "irrigation.task.conserve": "मिट्टी की नमी बचाएँ — खेत {fi}",
  "irrigation.task.conserveMeta": "बारानी · {crop} को ज़रूरत से कम पानी मिल रहा है",
  "irrigation.task.drain": "जल-निकासी जाँचें — खेत {fi}",
  "irrigation.task.drainMeta": "मिट्टी में पानी भरा है और और पानी आने वाला है",
  "irrigation.alert.wilting": "खेत {fi} मुरझाने की कगार पर है",
  "irrigation.alert.wiltingRainfed":
    "{crop} ने मिट्टी का लगभग सारा पानी इस्तेमाल कर लिया है, और सिंचाई का कोई साधन नहीं है। जितना हो सके मल्चिंग करें और मिट्टी को न छेड़ें।",
  "irrigation.alert.wiltingIrrigated":
    "{crop} ने मिट्टी का लगभग सारा उपलब्ध पानी इस्तेमाल कर लिया है। आज सिंचाई करें — लगभग {mm} मिमी।",
  "irrigation.alert.overfull": "खेत {fi} में ज़रूरत से ज़्यादा पानी है",
  "irrigation.alert.overfullBody":
    "जड़ों के आसपास की मिट्टी पहले से पानी से भरी है और और पानी आने वाला है। सिंचाई रोकें और खेत से पानी निकलने का रास्ता रखें — जलभराव से उपज उतनी ही घटती है जितनी सूखे से।",
  "irrigation.alert.dryFlowering": "खेत {fi} में फूल आने के समय सूखा",
  "irrigation.alert.dryFloweringBody":
    "बारानी खेत में {crop} पर फूल आ रहे हैं और उसे ज़रूरत से कम पानी मिल रहा है। इस समय पानी की कमी से किसी और अवस्था की तुलना में ज़्यादा उपज घटती है।",
  "term.the crop": "फसल",

  "analyticsCard.tipSeason": "{v}% बढ़त · {stage} · कटाई में {days} दिन",
  "analyticsCard.seriesProgress": "प्रगति",
  "analyticsCard.heatLimit": "गर्मी सीमा {n}°",
  "analyticsCard.seriesRain": "बारिश की संभावना",
  "analyticsCard.seriesHigh": "अधिकतम",
  "analyticsCard.seriesLow": "न्यूनतम",
  "analyticsCard.seriesIncome": "आय",
  "analyticsCard.seriesExpense": "खर्च",

  "forecastCard.title": "इस हफ़्ते का अनुमान",
  "forecastCard.subtitle": "आपके खेत के लाइव डेटा से AI पूर्वानुमान",
  "forecastCard.refresh": "पूर्वानुमान फिर से लाएँ",
  "forecastCard.irrigationRisk": "सिंचाई का खतरा",
  "forecastCard.diseaseRisk": "रोग/कीट का खतरा",

  "hazardCheck.original": "मूल चेतावनी, जैसी जारी की गई (अंग्रेज़ी)",

  "marketBoard.demandHigh": "ज़्यादा माँग",
  "marketBoard.demandMedium": "मध्यम माँग",
  "marketBoard.demandLow": "कम माँग",
  "marketAdvice.action.Sell now": "अभी बेचें",
  "marketAdvice.action.Hold": "रोककर रखें",
  "marketAdvice.action.Wait": "इंतज़ार करें",
  "term.₹/quintal": "₹/क्विंटल",

  // ── Risk levels ──
  "term.low": "कम",
  "term.medium": "मध्यम",
  "term.high": "ज़्यादा",

  // ── Crops (agronomy table + market list + common aliases) ──
  "term.crop": "फसल",
  "term.paddy": "धान",
  "term.rice": "चावल",
  "term.wheat": "गेहूँ",
  "term.maize": "मक्का",
  "term.corn": "मक्का",
  "term.bajra": "बाजरा",
  "term.jowar": "ज्वार",
  "term.ragi": "रागी",
  "term.groundnut": "मूंगफली",
  "term.cotton": "कपास",
  "term.soybean": "सोयाबीन",
  "term.sugarcane": "गन्ना",
  "term.onion": "प्याज़",
  "term.tomato": "टमाटर",
  "term.potato": "आलू",
  "term.chilli": "मिर्च",
  "term.mustard": "सरसों",
  "term.gram": "चना",
  "term.pigeonpea": "अरहर",
  "term.turmeric": "हल्दी",
  "term.banana": "केला",
  "term.sunflower": "सूरजमुखी",
  "term.sesame": "तिल",
  "term.castor": "अरंडी",
  "term.safflower": "कुसुम",
  "term.linseed": "अलसी",
  "term.niger": "रामतिल",
  "term.cauliflower": "फूलगोभी",
  "term.garlic": "लहसुन",
  "term.capsicum": "शिमला मिर्च",
  "term.brinjal": "बैंगन",
  "term.oilseed": "तिलहन",

  // ── Growth stages ──
  "term.germination": "अंकुरण",
  "term.seedling": "पौध",
  "term.vegetative": "वानस्पतिक वृद्धि",
  "term.flowering": "फूल आना",
  "term.maturity": "पकना",

  // ── Weather labels (src/lib/weather.ts) ──
  "term.clear sky": "साफ़ आसमान",
  "term.partly cloudy": "आंशिक बादल",
  "term.overcast": "घने बादल",
  "term.foggy": "कोहरा",
  "term.drizzle": "बूंदाबांदी",
  "term.rain": "बारिश",
  "term.snow": "बर्फ़बारी",
  "term.rain showers": "बौछारें",
  "term.snow showers": "बर्फ़ की बौछारें",
  "term.thunderstorm": "आंधी-तूफ़ान",

  // ── Weekdays (forecast) ──
  "term.mon": "सोम",
  "term.tue": "मंगल",
  "term.wed": "बुध",
  "term.thu": "गुरु",
  "term.fri": "शुक्र",
  "term.sat": "शनि",
  "term.sun": "रवि",
};

// ponytail: Hindi only for now; other locales fall back to English for these keys.
export const DYNAMIC: Record<Locale, Dict> = { en, hi, kn: {}, ta: {}, te: {}, ml: {}, mr: {}, bn: {}, pa: {} };
