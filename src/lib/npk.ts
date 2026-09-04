/**
 * Soil NPK interpretation — the same shape as `soilPh.ts`, for the same reason.
 *
 * ── The important caveat ─────────────────────────────────────────────────────
 * No NPK probe is wired to this app. Until one is, the numbers here are the
 * levels a Soil Health Card would call sufficient, carried so the assistant has
 * *some* nutrient footing when a farmer asks about fertiliser — not because
 * anyone measured this field.
 *
 * That distinction is load-bearing. The chat system prompt says "Never invent
 * farm data that isn't provided", and this codebase has form: it has already
 * had to strip out invented shops and star ratings hashed from shop names. So
 * `contextLineEn()` states the provenance inside the prompt itself, exactly as
 * `chatContext.ts` already distinguishes an "estimated harvest" from a
 * "planned harvest". If that wording is ever dropped, this becomes the same
 * class of bug.
 *
 * `labelEn` / `adviceEn` are for server contexts; client components render
 * `t("npk.*")` instead, matching the soilPh convention.
 */

export type NpkLevel = { label: string; value: number };

/**
 * Available N, P₂O₅ and K₂O in kg/ha, at the healthy end of the medium band in
 * Soil Health Card terms. Mirrors NPK_BASELINE in the sensors route — that copy
 * is what the panel renders, this one is what the assistant is told.
 */
export const NPK_BASELINE: NpkLevel[] = [
  { label: "N", value: 280 },
  { label: "P", value: 22 },
  { label: "K", value: 180 },
];

export const NPK_UNIT = "kg/ha";

export const npkLabelEn = "Sufficient (assumed, not measured)";

export const npkAdviceEn =
  "Treat this as a default rather than a fact about this field: recommend a soil test " +
  "before any large fertiliser purchase, and prefer split doses over a single heavy one.";

/**
 * The line handed to the assistant. Says what the numbers are and, in the same
 * breath, that nothing measured them.
 */
export function npkContextLineEn(): string {
  const levels = NPK_BASELINE.map((p) => `${p.label} ${p.value}`).join(", ");
  return (
    `Soil nutrients (${levels} ${NPK_UNIT}): no NPK sensor is connected to this farm, ` +
    `so these are assumed sufficiency levels, NOT a measurement of this field. ` +
    `Say so if the farmer asks about nutrient levels. ${npkAdviceEn}`
  );
}
