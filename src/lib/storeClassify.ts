/**
 * Deciding whether an OSM shop is actually of any use to a farmer.
 *
 * ── Why a tag is not enough ──────────────────────────────────────────────────
 * The locator used to ask Overpass for five tags and show everything that came
 * back. Measured 100 km around Ludhiana that is 92 results, 73 of them tagged
 * `hardware` or `doityourself` — six property advisors, a jeweller, a beauty
 * parlour, five vegetable shops, three music centres, two mobile-recharge
 * shops, a car wash, four steel merchants, machine tools, tyres, and a river
 * bridge. `shop=farm` is no better: in India it is used for farms rather than
 * farm suppliers, so it returns poultry sheds, a milk brand, "kamal sahdra
 * house" and "Jagga nijjar's villa".
 *
 * So the tag is treated as a hint and the NAME as the evidence. Indian agri
 * shops say what they are — "krishi kendra", "agro centre", "pesticide store",
 * "beej bhandar", "nursery" — and the junk says what it is too.
 *
 * ── Why the name cannot be the whole rule either ─────────────────────────────
 * "Roots and Shoots", a real botanical studio in Dharwad, contains no agri word
 * at all. A pure name gate drops it. So two tags whose meaning is unambiguous —
 * `garden_centre` and `agrarian` — are trusted on the tag alone, and everything
 * else has to earn its place by name. On the Ludhiana sample that combination
 * beat both halves: 13 kept out of 231 candidates, with no junk except one bare
 * personal name, and it rescued "Shri Ganesh pesticides and nursery", which is
 * mis-tagged `doityourself`.
 *
 * ── Why this does not reuse hazards/match.ts ─────────────────────────────────
 * `normalise()` there is the right shape, but it collapses `[^a-z0-9]` to
 * spaces, which erases Indic scripts completely — "ਸੋਸਾਇਟੀ ਢਿੱਲਵਾਂ" would
 * normalise to an empty string and never match anything. Widening that class
 * would change hazard district matching, which is load-bearing elsewhere, so
 * this keeps its own normaliser that preserves Unicode letters.
 */

/** Two tiers. `service` is useful to a farmer but is not a supply shop, so it
 *  ranks below `supplies` rather than being mixed in with it. */
export type StoreCategory = "supplies" | "service";

export type Classification = {
  category: StoreCategory;
  /** An i18n key, resolved in the component — never a display string. */
  labelKey: string;
};

/**
 * `garden_centre` is admitted on the tag alone. It is the one tag nobody
 * misapplies — every instance in the sample was a real nursery — and it is what
 * saves "Roots and Shoots", a genuine Dharwad nursery whose name contains no
 * agricultural word at all.
 */
const TRUSTED_TAGS = new Set(["garden_centre"]);

/**
 * `shop=agrarian` is *nearly* trustworthy, so it gets a weaker admission: the
 * name must read like a business.
 *
 * It should be the most reliable tag there is — it literally means agricultural
 * supplies — but Indian mappers also use it for farms and for people. Around
 * Ludhiana it returned "Arshdeep DhinDsa" and "kothe raje jang (jsbhau)", which
 * are somebody's name and somebody's field. Requiring one of these words costs
 * nothing real: every genuine `agrarian` result in the sample already matched
 * an agri keyword and never reaches this test.
 */
const BUSINESS_WORD =
  /\bstores?\b|\bshops?\b|agenc|\btraders?\b|trading|\bmart\b|\bmarket\b|\bcent(?:re|er)\b|bhandar|bhawan|\bdepot\b|supplier|\bcompany\b|\bco\b|\bsons\b|enterprise|corporat|udyog|\bsales\b|\bltd\b|\bpvt\b|\bfarms?\b|\bnursery\b/u;

/**
 * Lowercase and collapse punctuation, without destroying non-Latin names.
 *
 * Two details here are not optional, and getting either wrong silently breaks
 * every native-script keyword while leaving the English ones working — so the
 * failure looks like "the list is a bit short" rather than like a bug:
 *
 *  1. Combining marks are stripped only after a LATIN base, so "Café" folds to
 *     "cafe" while Indic vowel signs survive. A blanket `\p{M}` strip turns
 *     "ਸੋਸਾਇਟੀ" into "ਸਸਇਟ" and "ಕೃಷಿ" into "ಕಷ", which match nothing.
 *  2. The punctuation collapse keeps `\p{M}`. Marks are neither `\p{L}` nor
 *     `\p{N}`, so a `[^\p{L}\p{N}]` class deletes those same vowel signs a
 *     second time even after (1) is fixed.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/(?<=\p{Script=Latin})\p{M}+/gu, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

/**
 * Category keywords, most specific first — the first hit wins, so a
 * "seed & pesticide store" lands on seeds rather than falling through.
 *
 * Native-script terms are not decoration: the only cooperative the Ludhiana
 * sample found is written "ਸੋਸਾਇਟੀ ਢਿੱਲਵਾਂ", and a Latin-only list misses it.
 */
const RULES: { labelKey: string; category: StoreCategory; words: RegExp }[] = [
  {
    labelKey: "storeType.nursery",
    category: "supplies",
    words: /nursery|nurseries|sapling|garden\s*cent|horticult|ನರ್ಸರಿ|ತೋಟಗಾರಿಕೆ|नर्सरी|ਨਰਸਰੀ|নার্সারি/u,
  },
  {
    labelKey: "storeType.seeds",
    category: "supplies",
    words: /\bseeds?\b|beej|bija|ಬೀಜ|बीज|ਬੀਜ|বীজ|విత్తన|விதை/u,
  },
  {
    labelKey: "storeType.agroChemist",
    category: "supplies",
    words: /pestic|insectic|fungicid|herbicid|ಕೀಟನಾಶಕ|कीटनाशक|ਕੀਟਨਾਸ਼ਕ/u,
  },
  {
    labelKey: "storeType.fertiliser",
    category: "supplies",
    words: /fertili|manure|urea|\bdap\b|\bnpk\b|khad|ಗೊಬ್ಬರ|खाद|ਖਾਦ|সার/u,
  },
  {
    labelKey: "storeType.implements",
    category: "supplies",
    words: /tractor|implement|thresher|tiller|plough|plow|irrigat|sprinkler|drip\s|pump\s*(?:set|s\b)|ಟ್ರ್ಯಾಕ್ಟರ್|ट्रैक्टर/u,
  },
  {
    labelKey: "storeType.coldStore",
    category: "service",
    words: /cold\s*stor|cold\s*chain|ripening|ಶೀತಲ|शीत\s*गृह/u,
  },
  {
    labelKey: "storeType.grainMarket",
    category: "service",
    words: /grain\s*market|\bmandi\b|\bapmc\b|procurement|ಮಂಡಿ|मंडी|ਮੰਡੀ/u,
  },
  {
    labelKey: "storeType.cooperative",
    category: "service",
    words: /sahakari|sahkari|co-?operative|\bsociety\b|sangha|ಸಹಕಾರ|ಸಂಘ|सहकारी|ਸਹਿਕਾਰ|ਸੋਸਾਇਟੀ/u,
  },
  // The generic catch-all. Last, so anything more specific has already matched.
  {
    labelKey: "storeType.agriSupplies",
    category: "supplies",
    words: /krishi|kendra|agro|agri|kisan|farmer|ಕೃಷಿ|ಕೇಂದ್ರ|कृषि|किसान|ਖੇਤੀ|ਕਿਸਾਨ|কৃষি|వ్యవసాయ|விவசாய|കൃഷി/u,
  },
];

/**
 * Names that are plainly not a shop. Only ever applied to the trusted tags —
 * the whole point of the untrusted path is that it already requires a positive
 * match, so a second negative list there would be dead weight.
 *
 * `farm` needs care: it must reject "Ritik's farm" and "Chauhan Farms" without
 * touching "Lachhar Agri Farm" or "Zaildar Seed Farm", which are real
 * suppliers. It is only consulted when no agri keyword matched at all, so those
 * two are already safe by the time this runs.
 */
const NOT_A_SHOP =
  /\bvilla\b|\bhouse\b|\bpropert|\badvisor|\bfarms?\b|poultry|poltri|\bdairy\b|\bmilk\b|\bbridge\b|\bcollege\b|\bschool\b|\btemple\b/u;

/**
 * What this shop is, or null to drop it.
 *
 * An empty result is a real answer. A farmer sent to a car wash because it
 * carried `shop=hardware` loses the trip, and a short list of shops that are
 * actually there is worth more than a long list that is mostly noise.
 */
export function classify(name: string, tag: string | undefined): Classification | null {
  const n = normalise(name);
  if (!n) return null;

  const matched = RULES.find((r) => r.words.test(n));
  if (matched) return { category: matched.category, labelKey: matched.labelKey };

  // No agri word anywhere in the name. Only the tag can save it now.
  if (NOT_A_SHOP.test(n)) return null;

  if (tag && TRUSTED_TAGS.has(tag)) {
    return { category: "supplies", labelKey: "storeType.nursery" };
  }

  if (tag === "agrarian" && BUSINESS_WORD.test(n)) {
    return { category: "supplies", labelKey: "storeType.agriSupplies" };
  }

  return null;
}

/** Suppliers first, then the rest — each nearest-first within its tier. */
export const CATEGORY_RANK: Record<StoreCategory, number> = {
  supplies: 0,
  service: 1,
};
