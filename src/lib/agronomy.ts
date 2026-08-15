/**
 * Crop-aware agronomy engine — the single source of truth for crop timing,
 * growth stage, tasks and yield. Pure and isomorphic: no DB, no next/headers,
 * so it is safe to import from both client (onboarding) and server (dashboard).
 *
 * Replaces the old flat "120-day cycle for every crop" assumption with
 * per-crop cycle lengths, proportional growth stages, stage-specific tasks and
 * India-typical yield estimates.
 */

export type StageLabel =
  | "Germination"
  | "Seedling"
  | "Vegetative"
  | "Flowering"
  | "Maturity";

export const STAGE_LABELS: StageLabel[] = [
  "Germination",
  "Seedling",
  "Vegetative",
  "Flowering",
  "Maturity",
];

// Fraction of the cycle at which each stage ENDS. These reproduce the original
// 7 / 25 / 55 / 90-of-120-day thresholds, now applied proportionally so they
// scale to any crop's cycle length.
const STAGE_BOUNDS: { label: StageLabel; end: number }[] = [
  { label: "Germination", end: 0.06 },
  { label: "Seedling", end: 0.21 },
  { label: "Vegetative", end: 0.46 },
  { label: "Flowering", end: 0.75 },
  { label: "Maturity", end: 1.0 },
];

export type CropProfile = {
  displayName: string;
  cycleDays: number; // seeding → harvest
  yieldPerAcre: number; // typical, in quintals per acre
  waterHeavy: boolean; // needs standing water / heavy irrigation
  heatThreshold: number; // °C above which heat stress bites at sensitive stages
  oilseed?: boolean; // part of the oilseed group (mustard, groundnut, sesame…)
};

const DEFAULT_PROFILE: CropProfile = {
  displayName: "Crop",
  cycleDays: 120,
  yieldPerAcre: 18,
  waterHeavy: false,
  heatThreshold: 38,
};

// India-typical values. cycleDays = seeding → harvest; yieldPerAcre in quintals.
// Rough but sensible for advisory/demo use — refine per state/variety later.
const CROP_TABLE: Record<string, CropProfile> = {
  paddy: { displayName: "Paddy", cycleDays: 120, yieldPerAcre: 25, waterHeavy: true, heatThreshold: 37 },
  wheat: { displayName: "Wheat", cycleDays: 140, yieldPerAcre: 18, waterHeavy: false, heatThreshold: 33 },
  maize: { displayName: "Maize", cycleDays: 100, yieldPerAcre: 24, waterHeavy: false, heatThreshold: 38 },
  bajra: { displayName: "Bajra", cycleDays: 80, yieldPerAcre: 12, waterHeavy: false, heatThreshold: 42 },
  jowar: { displayName: "Jowar", cycleDays: 110, yieldPerAcre: 14, waterHeavy: false, heatThreshold: 40 },
  ragi: { displayName: "Ragi", cycleDays: 110, yieldPerAcre: 12, waterHeavy: false, heatThreshold: 38 },
  groundnut: { displayName: "Groundnut", cycleDays: 110, yieldPerAcre: 10, waterHeavy: false, heatThreshold: 38, oilseed: true },
  cotton: { displayName: "Cotton", cycleDays: 170, yieldPerAcre: 8, waterHeavy: false, heatThreshold: 40 },
  soybean: { displayName: "Soybean", cycleDays: 100, yieldPerAcre: 12, waterHeavy: false, heatThreshold: 38, oilseed: true },
  sugarcane: { displayName: "Sugarcane", cycleDays: 330, yieldPerAcre: 350, waterHeavy: true, heatThreshold: 40 },
  onion: { displayName: "Onion", cycleDays: 140, yieldPerAcre: 120, waterHeavy: false, heatThreshold: 36 },
  tomato: { displayName: "Tomato", cycleDays: 110, yieldPerAcre: 100, waterHeavy: false, heatThreshold: 35 },
  potato: { displayName: "Potato", cycleDays: 100, yieldPerAcre: 100, waterHeavy: false, heatThreshold: 30 },
  chilli: { displayName: "Chilli", cycleDays: 150, yieldPerAcre: 8, waterHeavy: false, heatThreshold: 38 },
  mustard: { displayName: "Mustard", cycleDays: 120, yieldPerAcre: 6, waterHeavy: false, heatThreshold: 32, oilseed: true },
  gram: { displayName: "Gram", cycleDays: 120, yieldPerAcre: 8, waterHeavy: false, heatThreshold: 33 },
  pigeonpea: { displayName: "Pigeonpea", cycleDays: 160, yieldPerAcre: 6, waterHeavy: false, heatThreshold: 40 },
  turmeric: { displayName: "Turmeric", cycleDays: 270, yieldPerAcre: 90, waterHeavy: true, heatThreshold: 38 },
  banana: { displayName: "Banana", cycleDays: 330, yieldPerAcre: 250, waterHeavy: true, heatThreshold: 38 },
  sunflower: { displayName: "Sunflower", cycleDays: 100, yieldPerAcre: 8, waterHeavy: false, heatThreshold: 38, oilseed: true },
  sesame: { displayName: "Sesame", cycleDays: 90, yieldPerAcre: 3, waterHeavy: false, heatThreshold: 42, oilseed: true },
  castor: { displayName: "Castor", cycleDays: 150, yieldPerAcre: 7, waterHeavy: false, heatThreshold: 42, oilseed: true },
  safflower: { displayName: "Safflower", cycleDays: 130, yieldPerAcre: 5, waterHeavy: false, heatThreshold: 36, oilseed: true },
  linseed: { displayName: "Linseed", cycleDays: 120, yieldPerAcre: 4, waterHeavy: false, heatThreshold: 33, oilseed: true },
  niger: { displayName: "Niger", cycleDays: 100, yieldPerAcre: 2, waterHeavy: false, heatThreshold: 36, oilseed: true },
};

// Map common synonyms/regional names onto the canonical table keys.
const ALIASES: Record<string, string> = {
  rice: "paddy",
  "pearl millet": "bajra",
  sorghum: "jowar",
  "finger millet": "ragi",
  peanut: "groundnut",
  tur: "pigeonpea",
  arhar: "pigeonpea",
  "red gram": "pigeonpea",
  "bengal gram": "gram",
  chickpea: "gram",
  chana: "gram",
  soya: "soybean",
  "soya bean": "soybean",
  chilly: "chilli",
  chili: "chilli",
  "chili pepper": "chilli",
  mirchi: "chilli",
  brinjal: "tomato",
  // Oilseed regional / trade names.
  rapeseed: "mustard",
  sarson: "mustard",
  toria: "mustard",
  canola: "mustard",
  til: "sesame",
  gingelly: "sesame",
  sesamum: "sesame",
  arandi: "castor",
  kardi: "safflower",
  flaxseed: "linseed",
  alsi: "linseed",
  ramtil: "niger",
  moongphali: "groundnut",
};

/** Canonical oilseed crops known to the engine, in rough national-importance order. */
export const OILSEED_CROPS = [
  "mustard",
  "groundnut",
  "soybean",
  "sesame",
  "sunflower",
  "castor",
  "safflower",
  "linseed",
  "niger",
] as const;

/** Whether a crop name (any alias/spelling) belongs to the oilseed group. */
export function isOilseed(name: string): boolean {
  const key = normalizeCrop(name);
  return !!key && CROP_TABLE[key]?.oilseed === true;
}

export function normalizeCrop(name: string): string {
  const base = (name ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "";
  if (CROP_TABLE[base]) return base;
  if (ALIASES[base]) return ALIASES[base];
  // try first word (e.g. "tomato hybrid" → "tomato")
  const first = base.split(" ")[0];
  if (CROP_TABLE[first]) return first;
  if (ALIASES[first]) return ALIASES[first];
  return "";
}

export function getCropProfile(name: string): CropProfile {
  const key = normalizeCrop(name);
  if (!key) return { ...DEFAULT_PROFILE, displayName: name?.trim() || "Crop" };
  return CROP_TABLE[key];
}

function daysSinceDate(dateISO: string): number {
  const then = new Date(dateISO).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/**
 * Length of this cycle in days: the farmer's own seeding → harvest window when
 * they set a harvest date, otherwise the crop table's typical cycle length.
 */
function cycleDaysFor(crop: string, seedingDate: string, estimatedHarvestDate?: string | null): number {
  const seeded = new Date(seedingDate).getTime();
  const harvest = estimatedHarvestDate ? new Date(estimatedHarvestDate).getTime() : NaN;
  if (!Number.isNaN(seeded) && !Number.isNaN(harvest) && harvest > seeded) {
    return Math.max(1, Math.round((harvest - seeded) / 86_400_000));
  }
  return getCropProfile(crop).cycleDays;
}

export type CropStageInfo = {
  label: StageLabel;
  progress: number; // 0..1 through the crop's own cycle
  day: number; // days since seeding
  cycleDays: number;
};

/**
 * Crop-aware growth stage. Falls back to a 120-day cycle for unknown crops.
 * When the farmer has set their own harvest date, the stage is measured against
 * that window so the growth stage agrees with the harvest countdown.
 */
export function cropStageFor(
  crop: string,
  seedingDate: string,
  estimatedHarvestDate?: string | null
): CropStageInfo {
  const cycleDays = cycleDaysFor(crop, seedingDate, estimatedHarvestDate);
  const day = daysSinceDate(seedingDate);
  const progress = Math.min(1, day / cycleDays);
  const bound = STAGE_BOUNDS.find((b) => progress <= b.end) ?? STAGE_BOUNDS[STAGE_BOUNDS.length - 1];
  return { label: bound.label, progress, day, cycleDays };
}

/**
 * Where to draw the progress line on an evenly-spaced stage timeline.
 *
 * The two scales disagree and cannot be used interchangeably: the stage bounds
 * are uneven (6 / 21 / 46 / 75 / 100 % of the cycle) while the dots on the card
 * are laid out at equal intervals (0 / 25 / 50 / 75 / 100 %). Drawing raw
 * progress against those dots puts the line behind its own label — at day 30 of
 * 100 the crop is Vegetative, but a 30% line sits well short of the Vegetative
 * dot at 50%.
 *
 * So interpolate piecewise: find the band the crop is in, see how far through
 * that band it is, and map that onto the gap between the two dots. The line then
 * moves a little every day AND always agrees with the highlighted stage.
 */
export function stageTimelinePct(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const lastIdx = STAGE_BOUNDS.length - 1; // 4
  let prev = 0;

  for (let i = 0; i < STAGE_BOUNDS.length; i++) {
    const end = STAGE_BOUNDS[i].end;
    if (p <= end) {
      // The final band has no dot beyond it — hold the line at the end.
      if (i >= lastIdx) return 100;
      const within = end === prev ? 1 : (p - prev) / (end - prev);
      return ((i + within) / lastIdx) * 100;
    }
    prev = end;
  }
  return 100;
}

export type HarvestInfo = {
  harvestDate: Date;
  harvestLabel: string;
  daysLeft: number;
  pct: number; // 0..100 grown
  cycleDays: number;
  estimated: boolean; // true when computed, false when the farmer set the date
};

/**
 * Crop-aware harvest countdown.
 *
 * `estimatedHarvestDate` is the farmer's own date for this cycle (onboarding, or
 * edited later). When present it wins outright: the countdown and the progress
 * bar are measured against it, so the dashboard reflects what the farmer
 * actually planned rather than the table's generic cycle length. Without it we
 * fall back to seeding date + the crop's cycle length.
 */
export function harvestInfo(
  crop: string,
  seedingDate: string,
  estimatedHarvestDate?: string | null
): HarvestInfo {
  const profile = getCropProfile(crop);
  const seeded = new Date(seedingDate).getTime();

  const override = estimatedHarvestDate ? new Date(estimatedHarvestDate).getTime() : NaN;
  const hasOverride = !Number.isNaN(override) && override > seeded;

  const harvest = hasOverride ? override : seeded + profile.cycleDays * 86_400_000;
  // Span the progress bar over the real planned window, not the generic cycle.
  const cycleDays = Math.max(1, Math.round((harvest - seeded) / 86_400_000));

  const daysLeft = Math.max(0, Math.ceil((harvest - Date.now()) / 86_400_000));
  const elapsed = Math.min(cycleDays, Math.max(0, Math.round((Date.now() - seeded) / 86_400_000)));
  const pct = Math.round((elapsed / cycleDays) * 100);

  return {
    harvestDate: new Date(harvest),
    harvestLabel: new Date(harvest).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    daysLeft,
    pct,
    cycleDays,
    estimated: !hasOverride,
  };
}

/**
 * Suggested harvest date (yyyy-mm-dd) for a crop seeded on a given day — the
 * value the onboarding form pre-fills. Returns "" when either input is unusable
 * so the caller can leave the field empty rather than showing a bogus date.
 */
export function suggestHarvestDate(crop: string, seedingDate: string): string {
  const seeded = new Date(seedingDate).getTime();
  if (!seedingDate || Number.isNaN(seeded)) return "";
  const { cycleDays } = getCropProfile(crop);
  return new Date(seeded + cycleDays * 86_400_000).toISOString().slice(0, 10);
}

/** Estimated total yield in quintals for an area (acres) of a crop. */
export function estimateYield(crop: string, areaAcres: number): number {
  const { yieldPerAcre } = getCropProfile(crop);
  return Math.round(yieldPerAcre * Math.max(0, areaAcres));
}

/** Human string stored on the crop cycle, e.g. "45 quintal (est.)". */
export function estimateYieldLabel(crop: string, areaAcres: number): string {
  return `${estimateYield(crop, areaAcres)} quintal (est.)`;
}

export type TaskSeed = {
  key: string; // stable id for dedupe / persistence
  title: string;
  meta: string;
  tone: "green" | "amber" | "blue";
  category: "irrigation" | "fertilizer" | "scouting" | "protection" | "harvest" | "general";
};

type FarmLike = {
  /** Farm row id. Task keys hang off this so they stay unique even if two farms share an index. */
  id?: string;
  farm_index: number;
  /** Used to tell rain-fed plots (moisture matters more) from irrigated ones. */
  irrigation?: string | null;
  crop: {
    chosen_crop: string;
    seeding_date: string;
    estimated_harvest_date?: string | null;
  } | null;
};

/** Rain-fed plots depend on stored soil moisture rather than a water source. */
function isRainFed(irrigation?: string | null): boolean {
  return /rain[\s-]?fed/i.test(irrigation ?? "");
}

/** Whether rain is likely in the next 3 forecast days. */
function rainSoon(weather: { daily: { precipProb: number }[] } | null): boolean {
  return !!weather?.daily?.slice(0, 3).some((d) => d.precipProb >= 50);
}

/** Soft ceiling on the day's list — routine checks are trimmed to fit, stage work never is. */
const MAX_TASKS = 10;

/**
 * Crop-stage + weather aware task list for a set of farms. Returns typed seeds;
 * the caller decides presentation and (later) persistence.
 *
 * Two tiers: each cropped farm's stage work is always included (so the list
 * scales with the number of farms), while routine checks — leaf scouting, soil
 * moisture, weeding — only fill the space left under MAX_TASKS, keeping the day
 * readable for a farmer with several plots.
 */
export function generateTasks(
  farms: FarmLike[],
  weather: { current?: { temp: number }; daily: { precipProb: number }[] } | null
): TaskSeed[] {
  const tasks: TaskSeed[] = [];
  const routine: TaskSeed[] = [];

  for (const f of farms) {
    if (!f.crop) continue;
    const crop = f.crop.chosen_crop;
    const harvestDate = f.crop.estimated_harvest_date;
    const p = getCropProfile(crop);
    const st = cropStageFor(crop, f.crop.seeding_date, harvestDate);
    const fi = f.farm_index; // shown to the farmer
    const fk = f.id ?? String(f.farm_index); // identifies the farm in task keys
    const dayMeta = `Day ${st.day} · ${st.label} stage`;

    switch (st.label) {
      case "Germination":
      case "Seedling":
        tasks.push({
          key: `scout-early-${fk}`,
          title: `Inspect ${crop} germination — Farm ${fi}`,
          meta: dayMeta,
          tone: "green",
          category: "scouting",
        });
        if (p.waterHeavy) {
          tasks.push({
            key: `water-early-${fk}`,
            title: `Maintain shallow standing water — Farm ${fi}`,
            meta: `${crop} · keep the field moist at establishment`,
            tone: "blue",
            category: "irrigation",
          });
        }
        break;
      case "Vegetative":
        tasks.push({
          key: `fert-veg-${fk}`,
          title: `Apply nitrogen top-dressing to ${crop} — Farm ${fi}`,
          meta: dayMeta,
          tone: "amber",
          category: "fertilizer",
        });
        routine.push({
          key: `weeds-veg-${fk}`,
          title: `Check for weeds around ${crop} — Farm ${fi}`,
          meta: `${dayMeta} · weeds compete hardest now`,
          tone: "green",
          category: "scouting",
        });
        break;
      case "Flowering":
        tasks.push({
          key: `scout-flower-${fk}`,
          title: `Scout ${crop} for pests & disease at flowering — Farm ${fi}`,
          meta: `${dayMeta} · avoid water stress now`,
          tone: "amber",
          category: "scouting",
        });
        break;
      case "Maturity": {
        const h = harvestInfo(crop, f.crop.seeding_date, harvestDate);
        tasks.push({
          key: `harvest-${fk}`,
          title: `Prepare for ${crop} harvest — Farm ${fi}`,
          meta: `~${h.daysLeft} days to harvest · arrange labour & drying`,
          tone: "green",
          category: "harvest",
        });
        break;
      }
    }

    // Leaf scouting once there is a canopy to inspect — the field check that
    // feeds the disease scanner.
    if (st.label !== "Germination") {
      routine.push({
        key: `leaf-check-${fk}`,
        title: "Inspect leaves for early signs of disease",
        meta: `${crop} · Farm ${fi}`,
        tone: "blue",
        category: "protection",
      });
    }

    // Soil moisture matters most where there's no irrigation to fall back on
    // and no rain coming.
    if (isRainFed(f.irrigation) && !rainSoon(weather) && st.label !== "Maturity") {
      routine.push({
        key: `moisture-${fk}`,
        title: `Check soil moisture — Farm ${fi}`,
        meta: "Rain-fed plot · no rain forecast",
        tone: "amber",
        category: "irrigation",
      });
    }
  }

  // Weather-driven, whole-farm tasks.
  if (rainSoon(weather)) {
    tasks.push({
      key: "weather-rain",
      title: "Hold irrigation & spraying — rain expected",
      meta: "Weather · next 72 hours",
      tone: "blue",
      category: "irrigation",
    });
  }
  const temp = weather?.current?.temp;
  if (typeof temp === "number") {
    const hotFarm = farms.find((f) => {
      if (!f.crop) return false;
      const p = getCropProfile(f.crop.chosen_crop);
      const st = cropStageFor(f.crop.chosen_crop, f.crop.seeding_date, f.crop.estimated_harvest_date);
      return (st.label === "Flowering" || st.label === "Vegetative") && temp >= p.heatThreshold;
    });
    if (hotFarm) {
      tasks.push({
        key: "weather-heat",
        title: "Irrigate early morning — heat stress risk",
        meta: `${temp}°C · protect crops at a sensitive stage`,
        tone: "amber",
        category: "irrigation",
      });
    }
  }

  // Weather and stage work first, then as many routine checks as still fit.
  return [...tasks, ...routine.slice(0, Math.max(0, MAX_TASKS - tasks.length))];
}
