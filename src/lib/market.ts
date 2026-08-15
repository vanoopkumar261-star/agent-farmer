/**
 * Mandi price data. Real prices come from the data.gov.in Agmarknet resource
 * (see ./agmarknet). When there's no API key, the API is down, or a commodity
 * isn't found for the region, we fall back to a deterministic seeded generator
 * so the UI still renders — clearly labelled `source: "estimated"` so nothing
 * fake is ever shown as real.
 */
import { fetchAgmarknet, type MandiRecord } from "./agmarknet";
import { mspFor } from "./msp";
import {
  buildBreakdown,
  DEFAULT_COST_PREFS,
  type CostPrefs,
  type MandiBreakdown,
} from "./mandi-costs";
import { resolveMandiPoints, distanceTo, type MandiKey } from "./mandi-geo";

export type CropMarket = {
  name: string;
  unit: string; // e.g. "₹/quintal"
  price: number;
  change: number; // live: % vs state median · estimated: % vs previous day
  demand: "High" | "Medium" | "Low";
  series: { d: string; price: number }[]; // live: modal across mandis · estimated: ~21-day trend
  source: "live" | "estimated";
  asOf?: string; // arrival date for live data
  min?: number;
  max?: number;
  mandis?: MandiRow[];
  /** Median modal price across every mandi reporting this crop — benchmark anchor. */
  stateMedian?: number;
};

export type MandiRow = {
  mandi: string;
  price: number;
  distanceKm?: number;
  place?: string;
  district?: string;
  state?: string;
  grade?: string;
  variety?: string;
  min?: number;
  max?: number;
  /** Populated by getMandiBoard() — the price breakdown behind this row. */
  breakdown?: MandiBreakdown;
};

const CROPS: { name: string; base: number; agmark: string[] }[] = [
  { name: "Paddy", base: 2320, agmark: ["paddy"] },
  { name: "Wheat", base: 2275, agmark: ["wheat"] },
  { name: "Maize", base: 2050, agmark: ["maize"] },
  { name: "Bajra", base: 2500, agmark: ["bajra"] },
  { name: "Groundnut", base: 6400, agmark: ["groundnut"] },
  { name: "Cotton", base: 7100, agmark: ["cotton"] },
  { name: "Soybean", base: 4700, agmark: ["soyabean", "soybean"] },
  { name: "Sugarcane", base: 340, agmark: ["sugarcane"] },
  { name: "Onion", base: 1850, agmark: ["onion"] },
  { name: "Tomato", base: 2200, agmark: ["tomato"] },
];

// ── Seeded (estimated) generator — deterministic per day, used as fallback ──

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

function seededMarket(name: string, base: number): CropMarket {
  const dayKey = new Date().toISOString().slice(0, 10);
  const rand = mulberry32(hash(name + dayKey));
  const trend = (rand() - 0.45) * base * 0.006;
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

  return { name, unit: "₹/quintal", price: last, change, demand, series, source: "estimated" };
}

// ── Region parsing from a reverse-geocoded address ──

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir",
  "Chandigarh", "Puducherry",
];

export function deriveRegion(address?: string | null): { state?: string; district?: string } {
  if (!address) return {};
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  let stateIdx = -1;
  let state: string | undefined;
  for (let i = 0; i < parts.length; i++) {
    const norm = parts[i].replace(/[0-9]/g, "").trim().toLowerCase();
    const match = INDIAN_STATES.find((s) => norm.includes(s.toLowerCase()));
    if (match) {
      state = match;
      stateIdx = i;
      break;
    }
  }
  const district = stateIdx > 0 ? parts[stateIdx - 1].replace(/[0-9]/g, "").trim() : undefined;
  return { state, district };
}

function shortName(market: string): string {
  return market.replace(/\s*(apmc|market|mandi)\s*/i, " ").trim().slice(0, 12) || market.slice(0, 12);
}

/** Build a real CropMarket from this crop's mandi records, or null if none. */
function liveMarket(
  name: string,
  matches: MandiRecord[],
  districtPref: string
): CropMarket | null {
  if (matches.length === 0) return null;

  // One row per market (first seen wins — records are latest-day).
  const byMarket = new Map<string, MandiRecord>();
  for (const m of matches) if (!byMarket.has(m.market)) byMarket.set(m.market, m);
  const mkts = Array.from(byMarket.values());

  // Focus market: prefer the farmer's district, else the best-priced market.
  const focus =
    (districtPref && mkts.find((m) => m.district.toLowerCase().includes(districtPref))) ||
    mkts.slice().sort((a, b) => b.modal - a.modal)[0];

  const modals = mkts.map((m) => m.modal).sort((a, b) => a - b);
  const median = modals[Math.floor(modals.length / 2)] || focus.modal;
  const change = median > 0 ? Number((((focus.modal - median) / median) * 100).toFixed(1)) : 0;

  const range = Math.max(1, focus.max - focus.min);
  const pos = (focus.modal - focus.min) / range;
  const demand: CropMarket["demand"] = pos > 0.66 ? "High" : pos < 0.33 ? "Low" : "Medium";

  const mandis: MandiRow[] = mkts
    .slice()
    .sort((a, b) => b.modal - a.modal)
    .slice(0, 6)
    .map((m) => ({
      mandi: m.market,
      price: m.modal,
      place: m.district,
      district: m.district,
      state: m.state,
      grade: m.grade,
      variety: m.variety,
      min: m.min,
      max: m.max,
    }));

  // Series = real modal price across nearby mandis today (cheapest → dearest).
  const series = mandis
    .slice()
    .sort((a, b) => a.price - b.price)
    .map((m) => ({ d: shortName(m.mandi), price: m.price }));

  return {
    name,
    unit: "₹/quintal",
    price: focus.modal,
    change,
    demand,
    series: series.length ? series : [{ d: shortName(focus.market), price: focus.modal }],
    source: "live",
    asOf: focus.arrivalDate,
    min: focus.min,
    max: focus.max,
    mandis,
    stateMedian: median,
  };
}

/**
 * Live mandi board for the farmer's region, crop by crop. Real prices where the
 * Agmarknet data covers the crop; deterministic estimates otherwise.
 */
export async function getMarket(
  region: { state?: string; district?: string } = {}
): Promise<CropMarket[]> {
  const records = region.state ? await fetchAgmarknet({ state: region.state }) : [];
  const districtPref = (region.district ?? "").toLowerCase();

  return CROPS.map((c) => {
    const matches = records.filter((r) =>
      c.agmark.some((a) => r.commodity.toLowerCase().includes(a))
    );
    return liveMarket(c.name, matches, districtPref) ?? seededMarket(c.name, c.base);
  });
}

/** Nearby-mandi comparison for a crop — real markets when available, else seeded. */
export function nearbyMandis(crop: CropMarket): MandiRow[] {
  if (crop.mandis && crop.mandis.length) return crop.mandis;

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

/**
 * The nearby-mandi board for every crop, with a full price breakdown attached to
 * each row: MSP and state-median benchmarks, statutory APMC charges, and the
 * modelled cost of getting the crop there.
 *
 * Geocoding runs once for all crops (markets repeat heavily across commodities),
 * so this is a single batched resolve rather than one per crop.
 *
 * Seeded (estimated) crops deliberately get NO transport line: their mandi names
 * and distances are invented, and costing an invented distance would dress a
 * guess up as arithmetic. The UI labels those cards "Estimated" wholesale.
 */
export async function getMandiBoard(
  crops: CropMarket[],
  ctx: {
    farmLat?: number | null;
    farmLng?: number | null;
    prefs?: CostPrefs;
    region?: { state?: string };
  } = {}
): Promise<Record<string, MandiRow[]>> {
  const prefs = ctx.prefs ?? DEFAULT_COST_PREFS;
  const rowsByCrop: Record<string, MandiRow[]> = {};
  for (const c of crops) rowsByCrop[c.name] = nearbyMandis(c);

  // One batched geocode pass across every live market on the board.
  const keys: MandiKey[] = [];
  for (const c of crops) {
    if (c.source !== "live") continue;
    for (const r of rowsByCrop[c.name]) {
      if (r.district && r.state) keys.push({ market: r.mandi, district: r.district, state: r.state });
    }
  }
  const points = keys.length ? await resolveMandiPoints(keys) : new Map();

  for (const c of crops) {
    const msp = mspFor(c.name);
    const isLive = c.source === "live";

    rowsByCrop[c.name] = rowsByCrop[c.name].map((r) => {
      const state = r.state ?? ctx.region?.state;
      const dist =
        isLive && r.district && r.state
          ? distanceTo(points, { market: r.mandi, district: r.district, state: r.state }, ctx.farmLat, ctx.farmLng)
          : { km: null, source: "unknown" as const };

      return {
        ...r,
        distanceKm: dist.km ?? r.distanceKm,
        breakdown: buildBreakdown({
          gross: r.price,
          state,
          distanceKm: dist.km,
          distanceSource: dist.source,
          msp: msp?.price ?? null,
          mspLabel: msp ? `${msp.kind} · ${msp.season}` : undefined,
          stateMedian: c.stateMedian ?? null,
          prefs,
        }),
      };
    });
  }

  return rowsByCrop;
}
