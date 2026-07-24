/**
 * Realistic mandi price data for major Indian crops.
 * Deterministic per day (seeded) so values are stable within a day but evolve.
 * Swap for the data.gov.in Agmarknet API later without changing the UI shape.
 */

export type CropMarket = {
  name: string;
  unit: string; // e.g. "₹/quintal"
  price: number;
  change: number; // % vs previous day
  demand: "High" | "Medium" | "Low";
  series: { d: string; price: number }[]; // ~21 day trend
};

const CROPS: { name: string; base: number }[] = [
  { name: "Paddy", base: 2320 },
  { name: "Wheat", base: 2275 },
  { name: "Maize", base: 2050 },
  { name: "Bajra", base: 2500 },
  { name: "Groundnut", base: 6400 },
  { name: "Cotton", base: 7100 },
  { name: "Soybean", base: 4700 },
  { name: "Sugarcane", base: 340 },
  { name: "Onion", base: 1850 },
  { name: "Tomato", base: 2200 },
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildSeries(name: string, base: number): CropMarket {
  const dayKey = new Date().toISOString().slice(0, 10);
  const rand = mulberry32(hash(name + dayKey));
  const trend = (rand() - 0.45) * base * 0.006; // per-day drift
  const days = 21;
  const series: { d: string; price: number }[] = [];
  let price = base * (0.92 + rand() * 0.12);
  for (let i = days - 1; i >= 0; i--) {
    price += trend + (rand() - 0.5) * base * 0.02;
    price = Math.max(base * 0.7, price);
    const date = new Date(Date.now() - i * 86_400_000);
    series.push({ d: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }), price: Math.round(price) });
  }
  const last = series[series.length - 1].price;
  const prev = series[series.length - 2].price;
  const change = Number((((last - prev) / prev) * 100).toFixed(1));
  const overall = (last - series[0].price) / series[0].price;
  const demand: CropMarket["demand"] = overall > 0.03 ? "High" : overall < -0.03 ? "Low" : "Medium";

  return {
    name,
    unit: name === "Sugarcane" ? "₹/quintal" : "₹/quintal",
    price: last,
    change,
    demand,
    series,
  };
}

export function getMarket(): CropMarket[] {
  return CROPS.map((c) => buildSeries(c.name, c.base));
}

export type MandiRow = { mandi: string; price: number; distanceKm: number };

/** Nearby-mandi comparison for a given crop (generated around its price). */
export function nearbyMandis(crop: CropMarket): MandiRow[] {
  const rand = mulberry32(hash(crop.name + "mandi" + new Date().toISOString().slice(0, 10)));
  const names = ["Hubballi APMC", "Dharwad Mandi", "Gadag Market", "Haveri APMC", "Ranebennur"];
  return names
    .map((mandi) => ({
      mandi,
      price: Math.round(crop.price * (0.96 + rand() * 0.08)),
      distanceKm: Math.round(5 + rand() * 60),
    }))
    .sort((a, b) => b.price - a.price);
}
