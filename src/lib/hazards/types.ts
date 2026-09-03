/**
 * One hazard, whatever produced it.
 *
 * The pipeline pulls from sources with very different authority — a government
 * warning issued by IMD, and a threshold we computed ourselves from a public
 * forecast — and they must never blur together in the UI. `tier` carries that
 * distinction all the way to the card:
 *
 *   'official' — a government body has issued this warning. Say who, verbatim.
 *   'derived'  — we worked it out from open weather data. Say that it is ours.
 *
 * Getting this wrong in the farmer's favour is not a rounding error: presenting
 * our own heuristic as an IMD warning would lend it authority it has not
 * earned, and the whole feature depends on farmers trusting what they are told.
 */
export type HazardTier = "official" | "derived";

/** The CAP 1.2 severity vocabulary, which the derived tier reuses. */
export type HazardSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";

export type HazardSource = "cap" | "derived" | "enso";

export type HazardAlert = {
  source: HazardSource;
  tier: HazardTier;
  /** Upstream's own id — the CAP <guid>. Makes repeated polling idempotent. */
  sourceGuid: string;
  /** Normalised event name, e.g. "Thunderstorm with Lightning". */
  event: string;
  severity: HazardSeverity;
  certainty?: string;
  urgency?: string;
  headline: string;
  /** The issuing agency's own advice. Never paraphrased. */
  instruction?: string;
  /** e.g. "IMD Kolkata", "CWC". Shown to the farmer. */
  sender?: string;
  districts: string[];
  state?: string;
  onset?: string;
  expires?: string;
  raw?: Record<string, unknown>;
};

/** Ranking for display and for deciding whether a push is warranted. */
export const SEVERITY_RANK: Record<HazardSeverity, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
};

export function isSeverity(v: string): v is HazardSeverity {
  return v === "Extreme" || v === "Severe" || v === "Moderate" || v === "Minor" || v === "Unknown";
}
