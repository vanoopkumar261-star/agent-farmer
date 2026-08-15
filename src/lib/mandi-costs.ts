/**
 * Mandi price breakdown — what the quoted modal price actually becomes in the
 * farmer's hand once statutory charges and the cost of getting there are taken
 * out, and how that compares to the government's declared floor price.
 *
 * ── THE THREE ACCURACY TIERS ─────────────────────────────────────────────────
 * Every line carries a `tier` so the UI can show where the number came from.
 * Mixing an exact ₹2,800 modal price with a guessed ₹180 transport charge and
 * presenting both in the same typeface would be dishonest, so we don't.
 *
 *   "exact"      Straight from the data.gov.in Agmarknet feed, or a published
 *                government figure. Not modelled by us at all.
 *   "statutory"  Real, publicly documented rates from state APMC Acts & rules —
 *                but maintained by hand here and amended by state notification,
 *                so they drift. Treat as indicative, verify before relying.
 *   "estimated"  No data source exists. Locally negotiated, farmer-specific.
 *                Modelled from defaults the farmer can override in Settings.
 *
 * ── SOURCING THE STATUTORY RATES ─────────────────────────────────────────────
 * Market fee, development cess and commission are set per state (and sometimes
 * per commodity) under that state's APMC Act. The table below is a good-faith
 * reading of commonly published rates, NOT a legal reference. Known wrinkles it
 * already encodes: Bihar repealed its APMC Act in 2006 (no market fee at all),
 * and Kerala never had a mandi system. Known wrinkles it does NOT encode:
 * commodity-specific exemptions (e.g. Maharashtra dropping market fee on fruit
 * & vegetables sold outside APMC yards), and rates that differ inside a state.
 * Verify against the state Agricultural Marketing Board before treating any
 * figure here as authoritative.
 */

export type CostTier = "exact" | "statutory" | "estimated";

export type CostLine = {
  label: string;
  /** ₹ per quintal. Negative = money leaving the farmer. */
  amount: number;
  tier: CostTier;
  /** Shown under the label — says where the number came from or how it was derived. */
  note: string;
};

/** Charges the farmer can tune in Settings, because nothing can source them. */
export type CostPrefs = {
  /** ₹ per quintal per km of road distance to the mandi. */
  transportPerQuintalKm: number;
  /** Loading + unloading (hamali / palledari), ₹ per quintal. */
  hamaliPerQuintal: number;
  /** Gunny bags (bardana), ₹ per quintal. Set to 0 if you reuse your own bags. */
  bardanaPerQuintal: number;
  /** Weighing / tolai charge, ₹ per quintal. */
  weighingPerQuintal: number;
  /** Expected moisture or quality cut as a % of gross. 0 for clean, graded produce. */
  qualityCutPercent: number;
};

export const DEFAULT_COST_PREFS: CostPrefs = {
  transportPerQuintalKm: 2.5,
  hamaliPerQuintal: 22,
  bardanaPerQuintal: 15,
  weighingPerQuintal: 5,
  qualityCutPercent: 0,
};

/** Statutory ad-valorem charges, as a % of the gross sale value. */
type StateCharges = {
  /** Market fee / mandi shulk levied by the APMC. */
  marketFeePct: number;
  /** Rural / agricultural development cess, where the state levies one on top. */
  cessPct: number;
  /** Commission agent (arhtiya / dalali) charge. */
  commissionPct: number;
  /** Anything the reader needs to know to interpret the above. */
  note?: string;
};

const STATE_CHARGES: Record<string, StateCharges> = {
  Punjab: { marketFeePct: 3, cessPct: 3, commissionPct: 2.5, note: "Market fee 3% + Rural Development Fund 3%" },
  Haryana: { marketFeePct: 2, cessPct: 2, commissionPct: 2.5, note: "Market fee 2% + HRDF 2%" },
  "Uttar Pradesh": { marketFeePct: 1, cessPct: 0.5, commissionPct: 2.5 },
  Rajasthan: { marketFeePct: 1.6, cessPct: 2, commissionPct: 2, note: "Mandi fee + Krishak Kalyan Fee" },
  "Madhya Pradesh": { marketFeePct: 1.7, cessPct: 0, commissionPct: 2 },
  Maharashtra: { marketFeePct: 1, cessPct: 0.05, commissionPct: 3, note: "Fruit & veg sold outside APMC yards are exempt" },
  Karnataka: { marketFeePct: 1.5, cessPct: 0, commissionPct: 2 },
  Gujarat: { marketFeePct: 1, cessPct: 0, commissionPct: 1.5 },
  "Andhra Pradesh": { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
  Telangana: { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
  "Tamil Nadu": { marketFeePct: 1, cessPct: 0, commissionPct: 1 },
  Kerala: { marketFeePct: 0, cessPct: 0, commissionPct: 1, note: "No APMC Act — no statutory market fee" },
  Bihar: { marketFeePct: 0, cessPct: 0, commissionPct: 2, note: "APMC Act repealed in 2006 — no market fee" },
  "West Bengal": { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
  Odisha: { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
  Chhattisgarh: { marketFeePct: 2, cessPct: 0, commissionPct: 2 },
  Jharkhand: { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
  Assam: { marketFeePct: 1, cessPct: 0, commissionPct: 2 },
};

const FALLBACK_CHARGES: StateCharges = {
  marketFeePct: 1.5,
  cessPct: 0,
  commissionPct: 2,
  note: "State rate unknown — national mid-range assumption",
};

export function chargesFor(state?: string): StateCharges & { known: boolean } {
  const hit = state ? STATE_CHARGES[state] : undefined;
  return hit ? { ...hit, known: true } : { ...FALLBACK_CHARGES, known: false };
}

export type Benchmark = {
  label: string;
  value: number;
  /** Gross vs this benchmark, in %. */
  deltaPct: number;
  tier: CostTier;
  note: string;
};

export type MandiBreakdown = {
  /** The quoted modal price — what the mandi board actually shows. ₹/quintal. */
  gross: number;
  /** Deductions, in the order a farmer meets them. All amounts negative. */
  lines: CostLine[];
  /** gross + Σ lines — the realistic farm-gate net. ₹/quintal. */
  net: number;
  /** Σ lines, positive number, for "you lose ₹X" phrasing. */
  totalDeductions: number;
  /** Deductions as a % of gross. */
  deductionPct: number;
  /** MSP and state-median anchors, whichever are available. */
  benchmarks: Benchmark[];
  distanceKm: number | null;
  distanceSource: "geocoded" | "district" | "unknown";
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the full breakdown for one mandi row.
 *
 * Deduction order mirrors how the money actually leaves: ad-valorem charges come
 * off the sale value at the yard, then the per-quintal costs of having got the
 * crop there. Quality cut is applied first because everything downstream is
 * levied on the accepted value, not the trolley weight.
 */
export function buildBreakdown({
  gross,
  state,
  distanceKm,
  distanceSource = "unknown",
  msp,
  mspLabel,
  stateMedian,
  prefs = DEFAULT_COST_PREFS,
}: {
  gross: number;
  state?: string;
  distanceKm?: number | null;
  distanceSource?: MandiBreakdown["distanceSource"];
  msp?: number | null;
  mspLabel?: string;
  stateMedian?: number | null;
  prefs?: CostPrefs;
}): MandiBreakdown {
  const charges = chargesFor(state);
  const lines: CostLine[] = [];

  const stateNote = charges.known
    ? `${state} APMC rules${charges.note ? ` · ${charges.note}` : ""}`
    : FALLBACK_CHARGES.note!;

  // ── Quality cut first: it shrinks the value everything else is charged on ──
  const qualityCut = prefs.qualityCutPercent > 0 ? (gross * prefs.qualityCutPercent) / 100 : 0;
  if (qualityCut > 0) {
    lines.push({
      label: `Moisture / quality cut (${prefs.qualityCutPercent}%)`,
      amount: -round(qualityCut),
      tier: "estimated",
      note: "Buyer's discretion at the yard — your own assumption, set in Settings",
    });
  }
  const accepted = gross - qualityCut;

  // ── Statutory, ad-valorem ──
  if (charges.marketFeePct > 0) {
    lines.push({
      label: `Market fee (${charges.marketFeePct}%)`,
      amount: -round((accepted * charges.marketFeePct) / 100),
      tier: "statutory",
      note: stateNote,
    });
  }
  if (charges.cessPct > 0) {
    lines.push({
      label: `Development cess (${charges.cessPct}%)`,
      amount: -round((accepted * charges.cessPct) / 100),
      tier: "statutory",
      note: stateNote,
    });
  }
  if (charges.commissionPct > 0) {
    lines.push({
      label: `Commission agent (${charges.commissionPct}%)`,
      amount: -round((accepted * charges.commissionPct) / 100),
      tier: "statutory",
      note: "Arhtiya / dalali — negotiable in practice",
    });
  }

  // ── Modelled, per-quintal ──
  if (distanceKm != null && prefs.transportPerQuintalKm > 0) {
    lines.push({
      label: `Transport (${Math.round(distanceKm)} km)`,
      amount: -round(distanceKm * prefs.transportPerQuintalKm),
      tier: "estimated",
      note:
        distanceSource === "geocoded"
          ? `₹${prefs.transportPerQuintalKm}/quintal/km · straight-line distance to the mandi town (±2-5 km)`
          : `₹${prefs.transportPerQuintalKm}/quintal/km · distance approximated from the district centre (±20-30 km)`,
    });
  }
  if (prefs.hamaliPerQuintal > 0) {
    lines.push({
      label: "Loading & unloading",
      amount: -prefs.hamaliPerQuintal,
      tier: "estimated",
      note: "Hamali / palledari — local rate, set in Settings",
    });
  }
  if (prefs.bardanaPerQuintal > 0) {
    lines.push({
      label: "Gunny bags",
      amount: -prefs.bardanaPerQuintal,
      tier: "estimated",
      note: "Bardana — set to ₹0 in Settings if you reuse your own",
    });
  }
  if (prefs.weighingPerQuintal > 0) {
    lines.push({
      label: "Weighing",
      amount: -prefs.weighingPerQuintal,
      tier: "estimated",
      note: "Tolai charge at the yard",
    });
  }

  const totalDeductions = round(lines.reduce((s, l) => s - l.amount, 0));
  const net = Math.round(gross - totalDeductions);

  const benchmarks: Benchmark[] = [];
  if (msp && msp > 0) {
    benchmarks.push({
      label: mspLabel ?? "MSP",
      value: msp,
      deltaPct: round(((gross - msp) / msp) * 100),
      tier: "exact",
      note: "Government declared floor price — published by CACP",
    });
  }
  if (stateMedian && stateMedian > 0) {
    benchmarks.push({
      label: "State median",
      value: stateMedian,
      deltaPct: round(((gross - stateMedian) / stateMedian) * 100),
      tier: "exact",
      note: "Median modal price across all mandis reporting this crop today",
    });
  }

  return {
    gross,
    lines,
    net,
    totalDeductions,
    deductionPct: round((totalDeductions / gross) * 100),
    benchmarks,
    distanceKm: distanceKm ?? null,
    distanceSource,
  };
}

/** Merge farmer overrides from `farmer_profiles.preferences` onto the defaults. */
export function costPrefsFrom(preferences?: Record<string, any> | null): CostPrefs {
  const raw = preferences?.mandiCosts ?? {};
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    transportPerQuintalKm: num(raw.transportPerQuintalKm, DEFAULT_COST_PREFS.transportPerQuintalKm),
    hamaliPerQuintal: num(raw.hamaliPerQuintal, DEFAULT_COST_PREFS.hamaliPerQuintal),
    bardanaPerQuintal: num(raw.bardanaPerQuintal, DEFAULT_COST_PREFS.bardanaPerQuintal),
    weighingPerQuintal: num(raw.weighingPerQuintal, DEFAULT_COST_PREFS.weighingPerQuintal),
    qualityCutPercent: Math.min(20, num(raw.qualityCutPercent, DEFAULT_COST_PREFS.qualityCutPercent)),
  };
}
