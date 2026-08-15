/**
 * Minimum Support Price (MSP) — the Government of India's declared floor price,
 * announced by CACP each season. Used as the "standard market price" benchmark
 * the Market page compares every mandi against.
 *
 * ── ACCURACY NOTE ─────────────────────────────────────────────────────────────
 * There is no MSP API on data.gov.in, so this table is maintained by hand.
 * Values below are ₹/quintal for KMS/RMS 2025-26. THEY MUST BE UPDATED EACH
 * SEASON — check https://cacp.dacnet.nic.in and the CCEA press release on
 * https://pib.gov.in before the Kharif (June) and Rabi (October) announcements.
 * `season` is rendered in the UI so a stale figure is visible, never silent.
 *
 * Not every crop has an MSP. Onion and Tomato are not notified crops — they have
 * no floor price at all, and `mspFor()` returns null rather than inventing one.
 * Sugarcane has an FRP (Fair & Remunerative Price), a legally binding mill-gate
 * price, not an MSP — flagged via `kind` so the UI can label it correctly.
 */

export type MspEntry = {
  /** ₹ per quintal. */
  price: number;
  /** MSP (notified floor) vs FRP (sugarcane mill-gate price) — different instruments. */
  kind: "MSP" | "FRP";
  /** Marketing season this figure belongs to, shown in the UI. */
  season: string;
  /** Which grade/variety the figure is for, where CACP declares more than one. */
  variety?: string;
};

/** Keyed by the crop names used in `CROPS` in ./market. */
const MSP_TABLE: Record<string, MspEntry> = {
  Paddy: { price: 2369, kind: "MSP", season: "KMS 2025-26", variety: "Common grade" },
  Wheat: { price: 2425, kind: "MSP", season: "RMS 2025-26" },
  Maize: { price: 2400, kind: "MSP", season: "KMS 2025-26" },
  Bajra: { price: 2775, kind: "MSP", season: "KMS 2025-26" },
  Groundnut: { price: 7263, kind: "MSP", season: "KMS 2025-26" },
  Cotton: { price: 7710, kind: "MSP", season: "KMS 2025-26", variety: "Medium staple" },
  Soybean: { price: 5328, kind: "MSP", season: "KMS 2025-26", variety: "Yellow" },
  Sugarcane: { price: 355, kind: "FRP", season: "SS 2025-26", variety: "At 10.25% recovery" },
  // Onion and Tomato are deliberately absent — no notified MSP exists.
};

/** The declared floor price for a crop, or null when the crop has none. */
export function mspFor(crop: string): MspEntry | null {
  return MSP_TABLE[crop] ?? null;
}
