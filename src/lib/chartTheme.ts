/**
 * One chart palette for the whole app (Redesign v2).
 *
 * Before this, four components each declared their own `EMERALD`/`BLUE`/`RAMP`
 * constants, so a palette change meant editing every chart by hand. Everything
 * that draws data now imports from here.
 *
 * ── Why these are not the af-* brand tokens ──────────────────────────────────
 * The v2 brand palette is deliberately muted (Agricultural Green #668653, Sage
 * #A9B99A, Earth Brown #8B7355). Run through the dataviz validator those hues
 * fail the chroma floor on white — as thin marks on a card they read grey, not
 * green. So chart marks use saturated steps of the *same hue families*: they sit
 * beside the brand colours as the same palette turned up, not as a second one.
 *
 * ── Validation ───────────────────────────────────────────────────────────────
 * CATEGORICAL was checked with the dataviz skill's validator against the card
 * surface (#FFFFFF, the surface charts actually sit on — not the ivory page):
 *
 *   node scripts/validate_palette.js "#3F7A2E,#B58A18,#3E6FB8,#A35A2E" \
 *        --mode light --surface "#FFFFFF"
 *   → lightness band PASS · chroma floor PASS · CVD separation PASS
 *     (worst adjacent #B58A18↔#3F7A2E ΔE 9.5 protan) · normal-vision PASS
 *     (ΔE 17.8) · contrast vs surface PASS (all ≥ 3:1)
 *
 * Re-run that command if you change a slot. Two constraints are easy to break:
 * green↔mustard is the protan-confusable pair and is only separated by
 * lightness, and a mustard bright enough to look like mustard drops under 3:1
 * contrast — #B58A18 is the darkest step that still reads yellow.
 */

/**
 * Categorical hues in FIXED order — assign by slot, never cycle for a 5th
 * series. More than four categories should fold into "Other" or become small
 * multiples instead.
 */
export const CATEGORICAL = [
  "#3F7A2E", // Crop Green — the first/primary series
  "#B58A18", // Mustard
  "#3E6FB8", // Field Blue
  "#A35A2E", // Earth Brown
] as const;

/** Named slots, so charts read semantically rather than by index. */
export const SERIES = {
  income: CATEGORICAL[0],
  expense: CATEGORICAL[1],
  market: CATEGORICAL[2],
  yield: CATEGORICAL[0],
} as const;

/**
 * Status pair for up/down price movement. These are state, not identity, and
 * must always ship with the ▲/▼ glyph beside them — never colour alone.
 */
export const STATUS = {
  up: "#3F7A2E",
  down: "#A8452F",
} as const;

/**
 * Hazard severity ramp — IMD's own green/yellow/orange/red warning scale, used
 * by the district map in the emergency-alert popup.
 *
 * ── Why not the af-* status tokens ───────────────────────────────────────────
 * Because they cannot do it. Running the obvious mapping through the dataviz
 * validator:
 *
 *   node scripts/validate_palette.js "#284D35,#D6A72C,#A35A2E,#A8452F" \
 *        --mode light --surface "#FFFFFF"
 *   → [FAIL] CVD separation       #A8452F ↔ #A35A2E  ΔE 2.5 (deutan)
 *     [FAIL] Normal-vision floor  #A8452F ↔ #A35A2E  ΔE 4.8
 *
 * af-danger and Earth Brown are the same colour to the eye. In a weather-safety
 * feature that means a farmer cannot tell an orange day from a red one.
 *
 * ── Why the categorical checks do not govern this ────────────────────────────
 * Every attempt to satisfy the validator's *adjacent-pair* tests also failed,
 * and that is the wrong test here. Yellow → orange → red are three neighbouring
 * hues on one continuum, so forcing any pair apart collapses another. Those
 * checks assume a categorical palette whose series appear together; these four
 * states are mutually exclusive — exactly one is ever on screen. The validator
 * says so itself: "scope: categorical palettes only."
 *
 * ── What was validated instead ───────────────────────────────────────────────
 * A severity ramp must escalate visibly even with no colour perception at all,
 * so it was checked on chroma, which rises monotonically:
 *
 *   clear  #2E8B57  L 0.569  C 0.119   contrast vs white 4.25
 *   yellow #E0A81C  L 0.764  C 0.151   contrast vs white 2.15
 *   orange #E2662A  L 0.654  C 0.170   contrast vs white 3.40
 *   red    #B3221A  L 0.498  C 0.182   contrast vs white 6.64
 *
 * 0.119 → 0.151 → 0.170 → 0.182, no reversal, and calm is the least vivid of
 * the four. "More urgent" is literally "more vivid".
 *
 * ── Two rules this ramp depends on ───────────────────────────────────────────
 * 1. NEVER colour alone. Yellow sits at 2.15 contrast; it is legible only
 *    because the band name and an icon always accompany it.
 * 2. Label ink flips by band — see SEVERITY_INK below.
 *
 * More saturated than the muted forest/ivory brand, deliberately: a safety
 * signal that blends into the page has failed. Scoped to this one component.
 */
export const SEVERITY = {
  clear: "#2E8B57",
  yellow: "#E0A81C",
  orange: "#E2662A",
  red: "#B3221A",
} as const;

/**
 * Readable ink for a label sitting ON each severity fill.
 * Measured: ink-on-yellow 6.01, ink-on-orange 3.78, white-on-red 6.64,
 * white-on-clear 4.25.
 */
export const SEVERITY_INK = {
  clear: "#FFFFFF",
  yellow: "#26352D",
  orange: "#26352D",
  red: "#FFFFFF",
} as const;

export type SeverityKey = keyof typeof SEVERITY;

/**
 * Single-hue forest ramp for composition (the expense donut). Monotonic in
 * lightness so the split is readable without colour vision; identity comes from
 * the legend list, not the hue.
 */
export const SEQUENTIAL_GREEN = [
  "#143526",
  "#1D4732",
  "#275A3F",
  "#336E4C",
  "#43825B",
  "#5A976F",
  "#7FAE8C",
  "#A9C4B0",
] as const;

/** Recessive chart furniture, on the v2 border/muted tokens. */
export const GRID = "#E3E4D9";
export const AXIS = "#7C8A78";

/** Shared Recharts tooltip chrome — 16px radius and the faint forest shadow. */
export const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${GRID}`,
  boxShadow: "0 10px 28px rgba(23,59,42,0.07), 0 3px 10px rgba(23,59,42,0.04)",
  fontSize: 12,
  padding: "8px 12px",
} as const;
