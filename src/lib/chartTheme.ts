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
