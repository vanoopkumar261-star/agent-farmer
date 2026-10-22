import type { CSSProperties } from "react";

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

/**
 * Overlay colours for the Leaflet map.
 *
 * Leaflet's `pathOptions` take literal colour strings and cannot read Tailwind
 * classes, so these mirror the `af-leaf` and `af-bg` tokens by value. Kept here
 * rather than inline in `StoreLocatorMap` so a palette change has one place to
 * look — the previous literals were the only app colours living inside a
 * component with no token reference at all.
 */
export const MAP = {
  /** Search-radius ring and fill over the default tiles. */
  radius: "#668653",
  /** Same ring over satellite imagery, where a dark green disappears. */
  radiusOnSatellite: "#F7F6F0",
} as const;

/** Recessive chart furniture, on the v2 border/muted tokens. */
export const GRID = "#E3E4D9";
export const AXIS = "#7C8A78";

/**
 * Ink for legend labels.
 *
 * Recharts colours a legend's text with its series colour by default, which
 * puts mustard type at 2.2:1 — unreadable. The dot carries the identity and
 * the text stays ink:
 *
 *   formatter={(v) => <span style={{ color: LEGEND_INK }}>{v}</span>}
 *
 * Exported because `AnalyticsCard` and `ExpenseCharts` had each inlined this
 * same literal, so the one value guaranteeing legend legibility lived nowhere.
 */
export const LEGEND_INK = "#3F5347";

/** Shared Recharts tooltip chrome — 16px radius and the faint forest shadow. */
export const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${GRID}`,
  boxShadow: "0 10px 28px rgba(23,59,42,0.07), 0 3px 10px rgba(23,59,42,0.04)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

/**
 * Marks that are not charts but must still come from one palette.
 *
 * A status dot, a slice separator or a map pin is a coloured mark a farmer
 * reads, and the moment one is hand-picked at a call site it starts drifting —
 * which is the whole reason `scripts/check-ui-rules.mjs` fails a build on a
 * hex literal in a `color`/`fill`/`stroke` position.
 *
 * `separator` is deliberately the surface it sits on, not white: it is a gap
 * between slices, so it must equal the card beneath them. That is also what
 * lets it follow a theme instead of punching a white line through a dark donut.
 */
export const MARK = {
  /** "Active" dots and online badges. Brighter than STATUS.up, which has to
   *  carry type-weight contrast; a 6px dot does not. */
  active: "#4EA76A",
  /** Slice/segment separator — matches the card surface. */
  separator: "#FFFFFF",
} as const;

/**
 * Leaflet basemap and marker chrome.
 *
 * Separate from MAP (which is the search-radius overlay) because these are the
 * map's own furniture: the raster tiles, and the pin HTML. Leaflet builds its
 * markers from HTML STRINGS inside `L.divIcon`, which cannot read a Tailwind
 * class, so every pin colour has to be a value a component can interpolate —
 * the same reason MAP exists.
 */
export const BASEMAP = {
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  /**
   * CARTO Dark Matter. A bright OSM raster is a glowing white rectangle on a
   * near-black page — the single most un-themeable surface in the app, and the
   * one place a tile swap is the only fix. Its attribution is NOT the OSM one:
   * CARTO requires its own credit, which is a licensing matter, not styling.
   */
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

/** Pin fills and strokes, per theme. */
export const PIN = {
  light: { home: "#173B2A", onHome: "#ffffff", active: "#284D35", idle: "#ffffff", ring: "#284D35" },
  dark: { home: "#5FBF82", onHome: "#07080A", active: "#5FBF82", idle: "#121316", ring: "#5FBF82" },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   Dark theme
   ---------------------------------------------------------------------------
   Every value above is the LIGHT palette and stays exported under its own
   name, so a component that has not been migrated yet still compiles and
   still renders correctly in light mode. Components that have been migrated
   call `useChartTheme()` and get the object for the active theme.

   Recharts needs literal colour strings — it cannot read a CSS variable — so
   this cannot be done with tokens the way the rest of the app is themed. The
   provider seeds its state from the server, so the first client render already
   knows the theme and no chart paints the wrong palette and then swaps.

   Measured against the dark CARD (#121316), which is the surface charts
   actually sit on — not the #070809 page.
   ───────────────────────────────────────────────────────────────────────── */

/** Lifted for dark. Same four hue families, same slot order, same meanings. */
const CATEGORICAL_DARK = [
  "#62C57A", // Crop Green    — 8.7:1
  "#DCAE2E", // Mustard       — 9.0:1
  "#6E9FE8", // Field Blue    — 6.9:1
  "#D98A5A", // Earth Brown   — 6.8:1
] as const;

/**
 * Severity on dark — a correctness fix, not a taste call.
 *
 * The light ramp's red (#B3221A) is 2.80:1 on #121316, under the 3:1 floor for
 * a graphical object, in the one feature that carries flood and cyclone
 * warnings. Escalation is still read from chroma, not from contrast-vs-
 * surface, so red remains the lowest-contrast of the four; that is correct.
 */
const SEVERITY_DARK = {
  clear: "#3FB37A",
  yellow: "#E8BE3C",
  orange: "#F0803C",
  red: "#F05B4F",
} as const;

/**
 * The sequential ramp REVERSES direction on dark.
 *
 * Its darkest steps (#143526, #1D4732) are invisible on a #121316 card, so the
 * ramp runs light→dark instead. Still monotonic in lightness, which is what
 * makes the donut readable without colour vision.
 */
const SEQUENTIAL_GREEN_DARK = [
  "#DCEFE2",
  "#C2E4CD",
  "#A8D7B7",
  "#8EC9A1",
  "#74B88B",
  "#5CA476",
  "#478C61",
  "#35734E",
] as const;

export type ChartPalette = {
  CATEGORICAL: readonly string[];
  SERIES: { income: string; expense: string; market: string; yield: string };
  STATUS: { up: string; down: string };
  SEVERITY: Record<SeverityKey, string>;
  SEVERITY_INK: Record<SeverityKey, string>;
  SEQUENTIAL_GREEN: readonly string[];
  MAP: { radius: string; radiusOnSatellite: string };
  MARK: { active: string; separator: string };
  GRID: string;
  AXIS: string;
  LEGEND_INK: string;
  /** Recharts' hover scrim. Black on light, white on dark — it is a shade of
   *  the surface, not a colour. */
  CURSOR_FILL: string;
  tooltipStyle: CSSProperties;
};

const LIGHT: ChartPalette = {
  CATEGORICAL,
  SERIES,
  STATUS,
  SEVERITY,
  SEVERITY_INK,
  SEQUENTIAL_GREEN,
  MAP,
  MARK,
  GRID,
  AXIS,
  LEGEND_INK,
  CURSOR_FILL: "rgba(0,0,0,0.03)",
  tooltipStyle: { ...tooltipStyle, backgroundColor: "#FFFFFF", color: "#173B2A" },
};

const DARK: ChartPalette = {
  CATEGORICAL: CATEGORICAL_DARK,
  SERIES: {
    income: CATEGORICAL_DARK[0],
    expense: CATEGORICAL_DARK[1],
    market: CATEGORICAL_DARK[2],
    yield: CATEGORICAL_DARK[0],
  },
  STATUS: { up: CATEGORICAL_DARK[0], down: "#EF6F57" },
  SEVERITY: SEVERITY_DARK,
  // White ink fails on all four dark bands (1.8:1 on the yellow), so the label
  // goes dark on every one of them.
  SEVERITY_INK: { clear: "#0B0D0C", yellow: "#0B0D0C", orange: "#0B0D0C", red: "#0B0D0C" },
  SEQUENTIAL_GREEN: SEQUENTIAL_GREEN_DARK,
  // #668653 disappears over dark tiles; the satellite case is unchanged,
  // since satellite imagery is dark in both themes.
  MAP: { radius: "#8ED9A6", radiusOnSatellite: "#F7F6F0" },
  MARK: { active: "#5FBF82", separator: "#121316" },
  GRID: "#2A2C31",
  AXIS: "#8A938D",
  LEGEND_INK: "#B9C2BC",
  CURSOR_FILL: "rgba(255,255,255,0.05)",
  tooltipStyle: {
    ...tooltipStyle,
    border: "1px solid #2A2C31",
    backgroundColor: "#121316",
    color: "#FFFFFF",
    // The light theme's forest shadow is invisible here; a tooltip genuinely
    // floats above the card, so it keeps a real one.
    boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.45)",
  },
};

/** The palette for a theme. Charts should reach for `useChartTheme()`. */
export function chartTheme(theme: "light" | "dark"): ChartPalette {
  return theme === "dark" ? DARK : LIGHT;
}
