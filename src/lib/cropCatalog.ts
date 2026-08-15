import { getCropProfile, normalizeCrop } from "./agronomy";

/**
 * Presentation data for the onboarding recommendation cards.
 *
 * Kept separate from agronomy.ts, which stays the numeric engine (cycle length,
 * yield, heat thresholds). This file holds what a card needs to *look* like a
 * card: a photograph, a category, the growing season and a one-line blurb.
 *
 * Photographs live in public/images/crops and are keyed by the same canonical
 * name `normalizeCrop` produces, so "sarson", "Mustard" and "rapeseed" all
 * resolve to the same picture. The pack was built by scripts/fetch-crop-images.mjs
 * (Wikimedia, no API key) and normalised by scripts/crop-images.py.
 */

export type CropCategory =
  | "Grains"
  | "Pulses"
  | "Oilseeds"
  | "Vegetables"
  | "Spices"
  | "Cash crop"
  | "Fruit";

/** Indian cropping season. Perennials and year-round crops say so plainly. */
export type CropSeason = "Kharif" | "Rabi" | "Kharif/Rabi" | "Year-round" | "Perennial";

export type CropCard = {
  key: string;
  name: string;
  image: string;
  category: CropCategory;
  season: CropSeason;
  /** Derived from the engine's waterHeavy flag so the two can't disagree. */
  water: "High Water" | "Medium Water";
  blurb: string;
};

type Entry = { category: CropCategory; season: CropSeason; blurb: string };

const CATALOG: Record<string, Entry> = {
  paddy: {
    category: "Grains",
    season: "Kharif",
    blurb: "Essential crop demanding high temperatures and standing water during early growth.",
  },
  wheat: {
    category: "Grains",
    season: "Rabi",
    blurb: "A staple grain requiring cool, moist growing conditions and dry, warm weather for ripening.",
  },
  maize: {
    category: "Grains",
    season: "Kharif/Rabi",
    blurb: "A fast, versatile cereal that rewards good drainage and steady nitrogen.",
  },
  bajra: {
    category: "Grains",
    season: "Kharif",
    blurb: "Hardy millet for dry, sandy land — tolerates heat and low rainfall better than most cereals.",
  },
  jowar: {
    category: "Grains",
    season: "Kharif",
    blurb: "Drought-resistant sorghum grown for both grain and fodder on light soils.",
  },
  ragi: {
    category: "Grains",
    season: "Kharif",
    blurb: "Nutritious finger millet suited to rain-fed uplands with modest inputs.",
  },
  gram: {
    category: "Pulses",
    season: "Rabi",
    blurb: "Cool-season pulse that fixes nitrogen and needs little irrigation once established.",
  },
  pigeonpea: {
    category: "Pulses",
    season: "Kharif",
    blurb: "Long-duration pulse with deep roots, often intercropped and valued for soil health.",
  },
  groundnut: {
    category: "Oilseeds",
    season: "Kharif",
    blurb: "Oilseed legume for well-drained sandy loam; pods develop underground after flowering.",
  },
  soybean: {
    category: "Oilseeds",
    season: "Kharif",
    blurb: "Protein-rich oilseed that fixes nitrogen and suits well-drained black soil.",
  },
  mustard: {
    category: "Oilseeds",
    season: "Rabi",
    blurb: "Cool-season oilseed with a short cycle and low water demand.",
  },
  sunflower: {
    category: "Oilseeds",
    season: "Kharif/Rabi",
    blurb: "Photo-insensitive oilseed that can be sown across seasons with reliable irrigation.",
  },
  sesame: {
    category: "Oilseeds",
    season: "Kharif",
    blurb: "Heat-loving oilseed for light soils; very sensitive to waterlogging.",
  },
  castor: {
    category: "Oilseeds",
    season: "Kharif",
    blurb: "Deep-rooted industrial oilseed that withstands drought and marginal land.",
  },
  safflower: {
    category: "Oilseeds",
    season: "Rabi",
    blurb: "Thistle-like oilseed grown on residual moisture with minimal irrigation.",
  },
  linseed: {
    category: "Oilseeds",
    season: "Rabi",
    blurb: "Cool-season oilseed valued for oil and fibre, tolerant of heavier soils.",
  },
  niger: {
    category: "Oilseeds",
    season: "Kharif",
    blurb: "Tribal-belt oilseed that grows on poor, acidic soils where little else will.",
  },
  onion: {
    category: "Vegetables",
    season: "Kharif/Rabi",
    blurb: "Bulb crop needing steady moisture early and dry weather as bulbs cure.",
  },
  tomato: {
    category: "Vegetables",
    season: "Kharif/Rabi",
    blurb: "A versatile warm-season crop needing regular watering and protection from frost.",
  },
  potato: {
    category: "Vegetables",
    season: "Rabi",
    blurb: "Cool-season tuber requiring loose, well-drained soil and consistent moisture.",
  },
  chilli: {
    category: "Spices",
    season: "Kharif/Rabi",
    blurb: "Long-duration spice crop that fruits over months and dislikes waterlogging.",
  },
  turmeric: {
    category: "Spices",
    season: "Kharif",
    blurb: "Rhizome spice with a nine-month cycle, heavy water need and shaded, rich soil.",
  },
  cotton: {
    category: "Cash crop",
    season: "Kharif",
    blurb: "Long-season fibre crop for black soil, with sustained pest pressure to manage.",
  },
  sugarcane: {
    category: "Cash crop",
    season: "Perennial",
    blurb: "Year-long cane needing heavy irrigation and rich soil, ratooned after harvest.",
  },
  banana: {
    category: "Fruit",
    season: "Perennial",
    blurb: "Perennial fruit demanding constant moisture, warmth and shelter from wind.",
  },
};

const FALLBACK: Entry = {
  category: "Grains",
  season: "Kharif/Rabi",
  blurb: "Suited to this farm's soil and season based on your registered details.",
};

/**
 * Card data for any crop name, however it is spelled.
 *
 * Returns a usable card even for an unknown crop — the model is constrained to
 * SUPPORTED_CROPS, but a farmer can type a custom crop during onboarding, and a
 * missing photo should degrade to a placeholder rather than a broken image.
 */
export function cropCard(name: string): CropCard {
  const key = normalizeCrop(name);
  const profile = getCropProfile(name);
  const entry = (key && CATALOG[key]) || FALLBACK;

  return {
    key,
    name: profile.displayName,
    image: key ? `/images/crops/${key}.webp` : "",
    category: entry.category,
    season: entry.season,
    water: profile.waterHeavy ? "High Water" : "Medium Water",
    blurb: entry.blurb,
  };
}

/** True when we actually hold a photograph for this crop. */
export function hasCropImage(name: string): boolean {
  return Boolean(normalizeCrop(name));
}
