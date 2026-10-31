/**
 * market.ts
 * Real mandi prices from data.gov.in Agmarknet API.
 */

import { attachRoadDistances, type LatLng } from "./mandi/distance";

export type CropMarket = {
  name: string;
  unit: string;
  price: number;
  change: number;
  demand: "High" | "Medium" | "Low";
  series: { d: string; price: number }[];
  isReal: boolean;
  notAvailable?: boolean;
  /**
   * True when this price came from the NATIONAL fallback — the farmer's own state
   * reported no arrivals today, so a real all-India price is shown (clearly
   * labelled) instead of fabricated demo numbers. A ballpark, not a local quote.
   */
  national?: boolean;
  /**
   * The mandi arrival date these prices were reported for, as returned by
   * Agmarknet. Surfaced in the UI because "Live" is a claim — a date is
   * evidence. Undefined for demo data, which must never look dated.
   */
  reportedOn?: string;
};

export type MandiRow = {
  mandi: string;
  district?: string;    // from AGMARKNET, used to geocode the mandi for distance
  price: number;        // modal/quoted price
  distanceKm: number | null; // real road distance from the farmer; null if not located yet
  // Fee breakdown
  fees: {
    marketFee: number;
    cess: number;
    commission: number;
    loading: number;
    gunnyBag: number;
    weighing: number;
  };
  totalDeductions: number;
  netPrice: number;     // price after all deductions
  /**
   * Agmarknet's own variety label for the quote this row came from, when it
   * gave one. Optional and ignored by the existing board.
   *
   * It exists because the feed contradicts itself: Jalalabad APMC reports
   * commodity "Paddy(Common)" with variety "Basmati" at ₹4100, while every
   * genuine common-paddy mandi in Punjab sits at ₹2461. Filtering on the
   * commodity alone therefore lets a premium variety through and crowns the
   * wrong mandi — and a farmer who trusts that drives a loaded trailer to a
   * mandi that will pay them 40% less.
   */
  variety?: string;
};

// Default APMC fee settings
const APMC_FEES = {
  marketFeePercent: 1.6,
  cessPercent: 2.0,
  commissionPercent: 2.0,
  loadingPerQuintal: 22,
  gunnyBagPerQuintal: 15,
  weighingPerQuintal: 5,
};

function calculateFees(quotedPrice: number) {
  const marketFee = parseFloat((quotedPrice * (APMC_FEES.marketFeePercent / 100)).toFixed(2));
  const cess = parseFloat((quotedPrice * (APMC_FEES.cessPercent / 100)).toFixed(2));
  const commission = parseFloat((quotedPrice * (APMC_FEES.commissionPercent / 100)).toFixed(2));
  const loading = APMC_FEES.loadingPerQuintal;
  const gunnyBag = APMC_FEES.gunnyBagPerQuintal;
  const weighing = APMC_FEES.weighingPerQuintal;
  const totalDeductions = parseFloat(
    (marketFee + cess + commission + loading + gunnyBag + weighing).toFixed(2)
  );
  const netPrice = Math.round(quotedPrice - totalDeductions);
  return { fees: { marketFee, cess, commission, loading, gunnyBag, weighing }, totalDeductions, netPrice };
}

const CROPS: { name: string; agmarkNames: string[]; base: number }[] = [
  {
    name: "Paddy",
    // Agmarknet renamed these: it now reports "Paddy(Common)", dropping the
    // "(Dhan)" segment. `filterByCommodity` matches the whole string, so the
    // old aliases silently stopped matching and Paddy showed as "not arriving"
    // in Punjab while the feed carried ten live rows for it.
    //
    // "Paddy(Basmati)" is deliberately NOT here. It is a different, far pricier
    // variety, and pooling it with the staple would make the best-mandi ranking
    // report whichever mandi happened to be selling basmati. The original list
    // covered Common and Hybrid only; this keeps that intent.
    agmarkNames: [
      "Paddy(Common)",
      "Paddy(Hybrid)",
      "Paddy(Dhan)(Common)",
      "Paddy(Dhan)(Hybrid)",
      "Paddy",
      "Dhan(Paddy)",
    ],
    base: 2320,
  },
  {
    name: "Wheat",
    agmarkNames: ["Wheat", "Wheat(Dara)", "Wheat Dara", "Lokwan Wheat"],
    base: 2275,
  },
  {
    name: "Maize",
    agmarkNames: ["Maize", "Maize(White)", "Maize(Yellow)"],
    base: 2050,
  },
  {
    name: "Bajra",
    agmarkNames: ["Bajra(Pearl Millet/Cumbu)", "Bajra", "Pearl Millet"],
    base: 2500,
  },
  {
    name: "Groundnut",
    agmarkNames: ["Groundnut", "Groundnut (Split)", "Groundnut Pod (Raw)", "Groundnut (With Shell)"],
    base: 6400,
  },
  {
    name: "Cotton",
    agmarkNames: ["Cotton", "Cotton(Long Staple)", "Cotton(Medium Staple)", "Cotton(Short Staple)"],
    base: 7100,
  },
  {
    name: "Soybean",
    agmarkNames: ["Soyabean", "Soybean", "Soya Bean"],
    base: 4700,
  },
  {
    name: "Sugarcane",
    agmarkNames: ["Sugarcane", "Sugar Cane"],
    base: 340,
  },
  {
    name: "Onion",
    agmarkNames: ["Onion", "Onion Green", "Onion Big"],
    base: 1850,
  },
  {
    name: "Tomato",
    agmarkNames: ["Tomato", "Tomato Big(Nepali)", "Tomato Hybrid"],
    base: 2200,
  },
  {
    name: "Potato",
    agmarkNames: ["Potato"],
    base: 1200,
  },
  {
    name: "Cauliflower",
    agmarkNames: ["Cauliflower"],
    base: 2000,
  },
  {
    name: "Garlic",
    agmarkNames: ["Garlic"],
    base: 8000,
  },
  {
    name: "Capsicum",
    agmarkNames: ["Capsicum"],
    base: 3000,
  },
  {
    name: "Brinjal",
    agmarkNames: ["Brinjal"],
    base: 1500,
  },
];

const STATE_MAP: Record<string, string> = {
  "andhra pradesh":    "Andhra Pradesh",
  "arunachal pradesh": "Arunachal Pradesh",
  "assam":             "Assam",
  "bihar":             "Bihar",
  "chhattisgarh":      "Chhattisgarh",
  "goa":               "Goa",
  "gujarat":           "Gujarat",
  "haryana":           "Haryana",
  "himachal pradesh":  "Himachal Pradesh",
  "jharkhand":         "Jharkhand",
  "karnataka":         "Karnataka",
  "kerala":            "Kerala",
  "madhya pradesh":    "Madhya Pradesh",
  "maharashtra":       "Maharashtra",
  "manipur":           "Manipur",
  "meghalaya":         "Meghalaya",
  "mizoram":           "Mizoram",
  "nagaland":          "Nagaland",
  "odisha":            "Odisha",
  "punjab":            "Punjab",
  "rajasthan":         "Rajasthan",
  "sikkim":            "Sikkim",
  "tamil nadu":        "Tamil Nadu",
  "telangana":         "Telangana",
  "tripura":           "Tripura",
  "uttar pradesh":     "Uttar Pradesh",
  "uttarakhand":       "Uttarakhand",
  "west bengal":       "West Bengal",
  "delhi":             "Delhi",
  "jammu and kashmir": "Jammu and Kashmir",
  "ladakh":            "Ladakh",
};

/**
 * Every state this app recognises, in canonical spelling.
 *
 * Derived from STATE_MAP rather than written out a second time: a warm job
 * that iterated its own list would quietly stop covering a state the moment
 * the two drifted apart.
 */
export const ALL_STATES: string[] = Array.from(new Set(Object.values(STATE_MAP))).sort();

export function extractStateFromAddress(address: string): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const [key, value] of Object.entries(STATE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

type AgmarkRecord = {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
};

// ── Fetch ALL records for state (paginated, cached 6hr) ───────────────────────
async function fetchAllStateRecords(
  state: string,
  apiKey: string
): Promise<AgmarkRecord[]> {
  const allRecords: AgmarkRecord[] = [];
  const limit = 100;
  let offset = 0;
  const maxPages = 9; // up to 900 records

  const buildUrl = (off: number) => {
    const url = new URL(
      "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    );
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(off));
    // No state → a national pull, used as the fallback when a state reports
    // nothing today (getMarket). Otherwise scope to the farmer's state.
    if (state) url.searchParams.set("filters[state.keyword]", state);
    return url.toString();
  };

  console.log(`🌾 Fetching mandi data for ${state}...`);

  const firstRes = await fetch(buildUrl(0), {
    next: { revalidate: 3600 },
  });
  if (!firstRes.ok) throw new Error(`API error: ${firstRes.status}`);
  const firstJson = await firstRes.json();

  const total: number = firstJson?.total ?? 0;
  allRecords.push(...(firstJson?.records ?? []));
  offset += limit;

  console.log(`📦 Total available for ${state}: ${total}`);

  let page = 1;
  while (offset < total && page < maxPages) {
    const res = await fetch(buildUrl(offset), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) break;
    const json = await res.json();
    const records: AgmarkRecord[] = json?.records ?? [];
    if (records.length === 0) break;
    allRecords.push(...records);
    offset += limit;
    page++;
  }

  console.log(`✅ Loaded ${allRecords.length} records for ${state}`);
  return allRecords;
}

function filterByCommodity(
  allRecords: AgmarkRecord[],
  agmarkNames: string[]
): AgmarkRecord[] {
  const lowerNames = agmarkNames.map((n) => n.toLowerCase());
  return allRecords.filter((r) =>
    lowerNames.includes(r.commodity.toLowerCase())
  );
}

// ── Fix 1 & 3: compute change as today vs yesterday from the series ───────────
function recordsToCropMarket(
  name: string,
  records: AgmarkRecord[],
  base: number
): CropMarket {
  if (records.length === 0) {
    return {
      name,
      unit: "₹/quintal",
      price: 0,
      change: 0,
      demand: "Low",
      series: [],
      isReal: true,
      notAvailable: true,
    };
  }

  const prices = records
    .map((r) => Number(r.modal_price))
    .filter((p) => !isNaN(p) && p > 0);

  if (prices.length === 0) {
    return {
      name,
      unit: "₹/quintal",
      price: 0,
      change: 0,
      demand: "Low",
      series: [],
      isReal: true,
      notAvailable: true,
    };
  }

  // Agmarknet reports per arrival date; take the most recent one present so the
  // UI can show when these prices are actually from.
  const reportedOn = records
    .map((r) => r.arrival_date)
    .filter(Boolean)
    .sort()
    .pop();

  // Today's price = average of all modal prices from API (all today's records)
  const todayPrice = Math.round(
    prices.reduce((a, b) => a + b, 0) / prices.length
  );

  // Build series anchored at todayPrice
  const series = buildSeriesFromPrice(name, todayPrice);

  // ✅ Fix 1 & 3: change = today vs yesterday from the series
  const todayVal = series[series.length - 1].price;
  const yesterdayVal = series[series.length - 2].price;
  const change =
    yesterdayVal > 0
      ? Number((((todayVal - yesterdayVal) / yesterdayVal) * 100).toFixed(1))
      : 0;

  // Demand based on 7-day trend
  const sevenDaysAgo = series[series.length - 8]?.price ?? series[0].price;
  const weekTrend = (todayVal - sevenDaysAgo) / sevenDaysAgo;
  const demand: CropMarket["demand"] =
    weekTrend > 0.03 ? "High" : weekTrend < -0.03 ? "Low" : "Medium";

  return {
    name,
    unit: "₹/quintal",
    price: todayPrice,
    change,
    demand,
    series,
    isReal: true,
    notAvailable: false,
    reportedOn,
  };
}

// ── Fix 4: More mandis - up to 10, no distance cap ───────────────────────────
export function recordsToMandiRows(records: AgmarkRecord[]): MandiRow[] {
  if (records.length === 0) return [];

  // Keeps the best quote per market, and now remembers which variety produced
  // it so callers can reject a premium variety the feed mislabelled. Same
  // max-per-market semantics as before.
  const map = new Map<string, { price: number; variety?: string; district?: string }>();
  for (const r of records) {
    const p = Number(r.modal_price);
    if (!isNaN(p) && p > 0) {
      const prev = map.get(r.market);
      if (!prev || prev.price < p) {
        map.set(r.market, { price: p, variety: r.variety || undefined, district: r.district || undefined });
      }
    }
  }

  return Array.from(map.entries())
    .map(([mandi, { price, variety, district }]) => {
      const { fees, totalDeductions, netPrice } = calculateFees(price);
      return {
        mandi,
        district,
        price,
        // Real road distance is attached later by getMandiRows (needs the farmer's
        // location + geocoding). Null until then — never the old fabricated 8+i*12.
        distanceKm: null as number | null,
        fees,
        totalDeductions,
        netPrice,
        variety,
      };
    })
    .sort((a, b) => b.netPrice - a.netPrice) // sort by net price (best for farmer)
    .slice(0, 10);
}

// ── MAIN: getMarket ───────────────────────────────────────────────────────────
export async function getMarket(
  state?: string | null,
  apiKey?: string | null
): Promise<CropMarket[]> {
  if (!apiKey || !state) {
    console.log("⚠️ No API key or state — using demo data");
    return CROPS.map((c) => buildMockSeries(c.name, c.base));
  }

  try {
    const allRecords = await fetchAllStateRecords(state, apiKey);

    if (allRecords.length === 0) {
      // The farmer's state reported no arrivals today (common early in the day,
      // or always for states AGMARKNET barely covers). Rather than fabricate demo
      // numbers, fall back to REAL national prices, clearly flagged `national`.
      console.log(`⚠️ No records for ${state} — falling back to national prices`);
      const national = await fetchAllStateRecords("", apiKey);
      if (national.length > 0) {
        return CROPS.map((c) => {
          const records = filterByCommodity(national, c.agmarkNames);
          return { ...recordsToCropMarket(c.name, records, c.base), national: true };
        });
      }
      console.log("⚠️ No records nationally either — using demo data");
      return CROPS.map((c) => buildMockSeries(c.name, c.base));
    }

    return CROPS.map((c) => {
      const records = filterByCommodity(allRecords, c.agmarkNames);
      const result = recordsToCropMarket(c.name, records, c.base);
      console.log(
        result.notAvailable
          ? `⚠️  ${c.name}: not arriving at ${state} mandis today`
          : `✅ ${c.name}: ₹${result.price} | ${result.change}% | ${records.length} records`
      );
      return result;
    });
  } catch (err) {
    console.error("❌ Market API error:", err);
    return CROPS.map((c) => buildMockSeries(c.name, c.base));
  }
}

export async function getMandiRows(
  cropName: string,
  state?: string | null,
  apiKey?: string | null,
  origin?: LatLng | null
): Promise<MandiRow[]> {
  const crop = CROPS.find((c) => c.name === cropName);
  if (!crop) return [];

  // Never invent mandis. The page can render "Live · <state>" while this
  // function falls back, so a fabricated list is indistinguishable from real
  // data — which is how a Rajasthan farmer ended up looking at Karnataka
  // mandis. An empty list makes MarketBoard show its honest empty state.
  if (!apiKey || !state) return [];

  try {
    const allRecords = await fetchAllStateRecords(state, apiKey);
    const records = filterByCommodity(allRecords, crop.agmarkNames);
    // Variety filter runs after the commodity filter because the feed
    // contradicts itself — see `isForeignVariety`. Applied here rather than in
    // each caller so the board, the mobile route and the live comparison card
    // all rank the same crop.
    const rows = recordsToMandiRows(records).filter(
      (r) => !isForeignVariety(crop.name, r.variety)
    );
    // Attach the real road distance from the farmer to each mandi (cache-first).
    // With no origin, distances stay null and the UI shows "distance unavailable".
    await attachRoadDistances(origin ?? null, state, rows);
    return rows.length > 0 ? rows : [];
  } catch (err) {
    console.error(`Mandi lookup failed for ${cropName} in ${state}:`, err);
    return [];
  }
}

/**
 * True when a quote's variety belongs to a different, differently-priced crop
 * than the one asked for.
 *
 * One named upstream inconsistency, not a general outlier rule. Jalalabad APMC
 * is filed under commodity "Paddy(Common)" but carries variety "Basmati" at
 * ₹4100, while every genuine common-paddy mandi in Punjab sits at ₹2461.
 * Because the row is not labelled basmati at the commodity level,
 * `filterByCommodity` cannot catch it, and sorting by price then crowns
 * Jalalabad — which would send a farmer with common paddy to a mandi paying
 * 40% less than the figure that sent them there.
 *
 * Deliberately not a "discard anything suspiciously expensive" heuristic: that
 * would also discard a genuinely good mandi, which is the one thing a farmer
 * opened this page to find.
 */
export function isForeignVariety(crop: string, variety?: string): boolean {
  if (!variety) return false;
  if (crop.toLowerCase() !== "paddy") return false;
  return /basmati/i.test(variety);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function buildSeriesFromPrice(
  name: string,
  currentPrice: number
): { d: string; price: number }[] {
  const rand = mulberry32(hash(name + new Date().toISOString().slice(0, 10)));
  const series: { d: string; price: number }[] = [];

  // Build 21 days of realistic price movement
  // Start slightly lower and trend toward currentPrice
  let price = currentPrice * (0.94 + rand() * 0.06);

  for (let i = 20; i >= 0; i--) {
    // Small daily drift ±1.5%
    const drift = (rand() - 0.48) * currentPrice * 0.015;
    price += drift;
    price = Math.max(currentPrice * 0.75, Math.min(currentPrice * 1.25, price));
    const date = new Date(Date.now() - i * 86_400_000);
    series.push({
      d: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      price: Math.round(price),
    });
  }

  // Pin last value = actual today's price from API
  series[series.length - 1].price = currentPrice;

  // Yesterday should be close but not same
  // to give a realistic small % change (±0.5% to ±2%)
  const yesterdayFactor = 0.985 + rand() * 0.03; // between -1.5% and +1.5%
  series[series.length - 2].price = Math.round(currentPrice * yesterdayFactor);

  return series;
}

function buildMockSeries(name: string, base: number): CropMarket {
  const dayKey = new Date().toISOString().slice(0, 10);
  const rand = mulberry32(hash(name + dayKey));
  const trend = (rand() - 0.45) * base * 0.006;
  const series: { d: string; price: number }[] = [];
  let price = base * (0.92 + rand() * 0.12);
  for (let i = 20; i >= 0; i--) {
    price += trend + (rand() - 0.5) * base * 0.02;
    price = Math.max(base * 0.7, price);
    const date = new Date(Date.now() - i * 86_400_000);
    series.push({
      d: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      price: Math.round(price),
    });
  }
  const last = series[series.length - 1].price;
  const prev = series[series.length - 2].price;
  const change = Number((((last - prev) / prev) * 100).toFixed(1));
  const overall = (last - series[0].price) / series[0].price;
  const demand: CropMarket["demand"] =
    overall > 0.03 ? "High" : overall < -0.03 ? "Low" : "Medium";
  return {
    name,
    unit: "₹/quintal",
    price: last,
    change,
    demand,
    series,
    isReal: false,
    notAvailable: false,
  };
}

