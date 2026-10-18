/**
 * The vocabulary of irrigation — the single source of truth for how a farm
 * gets its water, shared by onboarding, the add-farm modal and the irrigation
 * engine.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * Irrigation used to be one flat list of six strings that conflated two
 * different questions:
 *
 *   Borewell · Canal · River   →  WHERE the water comes from
 *   Drip · Sprinkler           →  HOW it is applied to the field
 *   Rain-fed                   →  neither; there is no irrigation at all
 *
 * A farmer on a borewell is still applying that water somehow, and a farmer on
 * drip is still drawing it from somewhere — so the old list forced them to
 * discard half of their own answer. Worse, the half that matters most for
 * scheduling is the one most farmers did not pick: application *efficiency* is
 * a property of the method, and without it there is no way to turn "the crop
 * needs 18 mm" into "run the pump for two hours".
 *
 * So the question is now asked in two stages — regime first, then source and
 * method — and this module holds all three vocabularies plus the physical
 * constants the engine needs.
 *
 * ── Why the lists live here and not in the page ──────────────────────────────
 * They were previously declared twice, in `src/app/onboarding/page.tsx` and
 * again in `src/components/dashboard/AddFarmModal.tsx`, and the two had already
 * drifted: the modal defaulted to "Rain-fed" long after onboarding removed that
 * default for producing 54 rain-fed farms out of 60. One list, imported twice,
 * cannot drift.
 *
 * Pure and isomorphic — no DB, no `next/headers` — so both the client wizard
 * and the server-rendered dashboard can import it.
 */

export type WaterRegime = "rainfed" | "irrigated";

export const WATER_REGIMES = ["rainfed", "irrigated"] as const;

export const IRRIGATION_SOURCES = [
  "borewell",
  "canal",
  "river",
  "tank",
  "pond",
  "lift",
  "rainwater_harvest",
] as const;

export const IRRIGATION_METHODS = [
  "drip",
  "sprinkler",
  "rain_gun",
  "furrow",
  "basin",
  "flood",
  "manual_hose",
] as const;

export type IrrigationSource = (typeof IRRIGATION_SOURCES)[number];
export type IrrigationMethod = (typeof IRRIGATION_METHODS)[number];

/** i18n keys, following the existing `onboarding.irrigation.<slug>` convention. */
export const REGIME_KEY: Record<WaterRegime, string> = {
  rainfed: "onboarding.irrigation.regime.rainfed",
  irrigated: "onboarding.irrigation.regime.irrigated",
};

export const SOURCE_KEY: Record<IrrigationSource, string> = {
  borewell: "onboarding.irrigation.source.borewell",
  canal: "onboarding.irrigation.source.canal",
  river: "onboarding.irrigation.source.river",
  tank: "onboarding.irrigation.source.tank",
  pond: "onboarding.irrigation.source.pond",
  lift: "onboarding.irrigation.source.lift",
  rainwater_harvest: "onboarding.irrigation.source.rainwaterHarvest",
};

export const METHOD_KEY: Record<IrrigationMethod, string> = {
  drip: "onboarding.irrigation.method.drip",
  sprinkler: "onboarding.irrigation.method.sprinkler",
  rain_gun: "onboarding.irrigation.method.rainGun",
  furrow: "onboarding.irrigation.method.furrow",
  basin: "onboarding.irrigation.method.basin",
  flood: "onboarding.irrigation.method.flood",
  manual_hose: "onboarding.irrigation.method.manualHose",
};

/**
 * English labels, used for the composite written to the legacy
 * `farms.irrigation` column and anywhere a translation is unavailable.
 * Deliberately short — the composite is shown on a chip.
 */
export const REGIME_EN: Record<WaterRegime, string> = {
  rainfed: "Rain-fed",
  irrigated: "Irrigated",
};

export const SOURCE_EN: Record<IrrigationSource, string> = {
  borewell: "Borewell",
  canal: "Canal",
  river: "River",
  tank: "Tank",
  pond: "Farm pond",
  lift: "Lift irrigation",
  rainwater_harvest: "Harvested rainwater",
};

export const METHOD_EN: Record<IrrigationMethod, string> = {
  drip: "Drip",
  sprinkler: "Sprinkler",
  rain_gun: "Rain gun",
  furrow: "Furrow",
  basin: "Basin",
  flood: "Flood",
  manual_hose: "Manual hose",
};

/**
 * Application efficiency — the share of water applied that actually reaches the
 * root zone. The rest is lost to evaporation, wind drift, deep percolation past
 * the roots and runoff.
 *
 * These are mid-points of the ranges in FAO Irrigation & Drainage Paper 24/56
 * and Indian extension guidance for smallholder systems. They are a starting
 * figure for a farm with no flow meter, not a measurement of this particular
 * system — a drip line with clogged emitters does far worse than 0.90 — and
 * every caller shows that caveat beside the number.
 *
 * This is the most load-bearing constant in the feature: it converts a crop's
 * water NEED into the water a farmer must actually pump.
 */
export const METHOD_EFFICIENCY: Record<IrrigationMethod, number> = {
  drip: 0.9,
  sprinkler: 0.75,
  rain_gun: 0.7,
  manual_hose: 0.65,
  furrow: 0.6,
  basin: 0.55,
  flood: 0.5,
};

/**
 * Typical system discharge in litres per hour per acre, for turning a required
 * depth into a run time.
 *
 * ── Reading these ────────────────────────────────────────────────────────────
 * 1 mm of depth over one acre is 4,047 litres, so these are roughly:
 *
 *   drip 3 mm/h · sprinkler 5 mm/h · rain gun 7 mm/h
 *   hose 2 mm/h · furrow 10 mm/h · basin & flood 12 mm/h
 *
 * which are the standard application-rate bands for each system. Drip is often
 * called "low flow", and each emitter is — but an acre carries several thousand
 * of them, so the system total is not small. Taking the per-emitter figure as
 * the per-acre figure is an easy mistake and produces advice like "run the pump
 * for thirty hours", which no farmer would follow and which would be wrong.
 *
 * Surface-method rates really depend on the pump, not the method. A farmer who
 * knows their own discharge should override this — until then the run time is
 * an estimate and the UI says so.
 */
export const METHOD_DISCHARGE_LPH_PER_ACRE: Record<IrrigationMethod, number> = {
  drip: 12000,
  sprinkler: 20000,
  rain_gun: 28000,
  manual_hose: 8000,
  furrow: 40000,
  basin: 48000,
  flood: 48000,
};

/** One acre in square metres. 1 mm of depth over 1 m² is exactly 1 litre. */
export const SQM_PER_ACRE = 4046.86;

/** Depth in mm over an area in acres → volume in litres. */
export function mmToLitres(mm: number, areaAcres: number): number {
  return mm * areaAcres * SQM_PER_ACRE;
}

export function isWaterRegime(v: unknown): v is WaterRegime {
  return typeof v === "string" && (WATER_REGIMES as readonly string[]).includes(v);
}

export function isIrrigationSource(v: unknown): v is IrrigationSource {
  return typeof v === "string" && (IRRIGATION_SOURCES as readonly string[]).includes(v);
}

export function isIrrigationMethod(v: unknown): v is IrrigationMethod {
  return typeof v === "string" && (IRRIGATION_METHODS as readonly string[]).includes(v);
}

/**
 * The human-readable string written to the legacy `farms.irrigation` column.
 *
 * That column is `not null` and is read in a dozen places — the farm chip, the
 * assistant's context block, three LLM prompts — none of which should have to
 * learn the new shape at once. Keeping it populated makes this migration
 * additive rather than a rewrite.
 *
 * Rain-fed MUST render as exactly "Rain-fed" so `isRainFed()` in `agronomy.ts`
 * and the health score's water-risk factor keep matching. Both test
 * `/rain[\s-]?fed/i` against this string; a value like "No irrigation" would
 * silently switch two rules off.
 */
export function composeIrrigationLabel(
  regime: WaterRegime,
  source?: IrrigationSource | null,
  method?: IrrigationMethod | null
): string {
  if (regime === "rainfed") return REGIME_EN.rainfed;
  const parts = [source ? SOURCE_EN[source] : null, method ? METHOD_EN[method] : null].filter(
    Boolean
  );
  return parts.length ? parts.join(" · ") : REGIME_EN.irrigated;
}

/**
 * Best-effort reading of a farm row that predates the split columns.
 *
 * Rows written before migration 029 have only the free-text label, and it may
 * be any of the six legacy values — or free text typed by hand, since the
 * column never had a CHECK constraint. Anything unrecognised is treated as
 * irrigated with an unknown method, which the engine handles by falling back to
 * a conservative efficiency rather than refusing to compute.
 */
export function parseLegacyIrrigation(label: string | null | undefined): {
  regime: WaterRegime;
  source: IrrigationSource | null;
  method: IrrigationMethod | null;
} {
  const s = (label ?? "").trim();
  if (!s) return { regime: "irrigated", source: null, method: null };
  if (/rain[\s-]?fed/i.test(s)) return { regime: "rainfed", source: null, method: null };

  const source: IrrigationSource | null = /borewell|bore\s?well|tube\s?well/i.test(s)
    ? "borewell"
    : /canal/i.test(s)
      ? "canal"
      : /river/i.test(s)
        ? "river"
        : /tank/i.test(s)
          ? "tank"
          : /pond/i.test(s)
            ? "pond"
            : /lift/i.test(s)
              ? "lift"
              : null;

  const method: IrrigationMethod | null = /drip/i.test(s)
    ? "drip"
    : /rain\s?gun/i.test(s)
      ? "rain_gun"
      : /sprinkler/i.test(s)
        ? "sprinkler"
        : /furrow/i.test(s)
          ? "furrow"
          : /basin/i.test(s)
            ? "basin"
            : /flood/i.test(s)
              ? "flood"
              : /hose/i.test(s)
                ? "manual_hose"
                : null;

  return { regime: "irrigated", source, method };
}

/**
 * The efficiency to compute with, given what the farm actually told us.
 *
 * An unknown method falls back to 0.6 — roughly surface irrigation. Assuming
 * drip's 0.90 would understate the water a farmer has to pump by a third, which
 * is the dangerous direction to be wrong in.
 */
export function efficiencyFor(method: IrrigationMethod | null | undefined): {
  value: number;
  assumed: boolean;
} {
  if (method && METHOD_EFFICIENCY[method] != null) {
    return { value: METHOD_EFFICIENCY[method], assumed: false };
  }
  return { value: 0.6, assumed: true };
}

export function dischargeFor(method: IrrigationMethod | null | undefined): number {
  return method ? METHOD_DISCHARGE_LPH_PER_ACRE[method] : 10000;
}
