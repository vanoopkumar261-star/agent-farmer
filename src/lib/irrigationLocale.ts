import type { Locale } from "./i18n/config";
import { translateMany, translationEnabled } from "./translate";
import type { IrrigationPlan } from "./irrigation";

/**
 * Renders an irrigation plan's prose in the farmer's language.
 *
 * The engine composes its explanations from the farm's own numbers, so those
 * sentences exist only at request time and cannot live in a dictionary. This
 * takes the finished plan, sends the prose through `translateMany` in one
 * batch, and hands back a plan whose numbers are untouched.
 *
 * ── What is translated, and what is deliberately not ─────────────────────────
 *
 * Only fields that are prose and are *read by nobody but the renderer*:
 *
 *     factors[].label        the explainable breakdown
 *     schedule[].reason      why each watering is on that day
 *     savings.vsBaseline     what the comparison was against
 *     savings.provenance     the mandatory "this is modelled, not metered" line
 *     soilNote               the water-holding-capacity caveat
 *
 * Four fields that look equally translatable are left alone on purpose:
 *
 *   · `stage.label` is compared against the literal "Flowering" in three places
 *     — `irrigation.ts` tightens the refill point on it and raises an alert on
 *     it, and `RainfedAdvisory` shows its yield-loss warning on it. Translating
 *     it would silently switch off the protection for the single growth stage
 *     where water stress costs the most, which is the worst possible thing for
 *     this feature to break, and it would break without an error.
 *
 *   · `verdict` and `status` are union members, not sentences. Their wording is
 *     chosen in the components and belongs in the dictionaries.
 *
 *   · `irrigationLabel` comes from `irrigationCatalog.ts`, which already carries
 *     an i18n key per source and method. Hand-written labels beat MT, and
 *     translating here would produce a second, different Hindi for a term the
 *     onboarding flow has already named.
 *
 *   · `cropName` is the crop as the farmer themselves chose it, and it appears
 *     inside factor sentences that *are* translated whole — so the crop still
 *     reads in Hindi there, while the standalone label keeps matching what the
 *     rest of the app calls that crop.
 *
 * Returns the plans unchanged, without a network call, for every locale outside
 * `TRANSLATE_LOCALES` — so the eight locales this was not enabled for behave
 * exactly as they did before it existed.
 */
export async function localiseIrrigationPlans(
  plans: IrrigationPlan[],
  locale: Locale
): Promise<IrrigationPlan[]> {
  if (!translationEnabled(locale) || !plans.length) return plans;

  // One flat batch for the whole page. Collected in a fixed order and spliced
  // back by the same walk, so a translation can never land on another farm's
  // field: `translateMany` guarantees index correspondence and returns the
  // English original wherever a string was skipped or failed.
  const source: string[] = [];
  for (const p of plans) {
    for (const f of p.factors) source.push(f.label);
    for (const s of p.schedule) source.push(s.reason);
    if (p.savings) source.push(p.savings.vsBaseline, p.savings.provenance);
    source.push(p.soilNote);
  }

  let out: string[];
  try {
    out = await translateMany(source, locale);
  } catch {
    // `translateMany` already swallows per-string failures; this is only here
    // so that an unexpected throw degrades to English prose rather than
    // taking down a page of correctly computed numbers.
    return plans;
  }

  let i = 0;
  return plans.map((p) => ({
    ...p,
    factors: p.factors.map((f) => ({ ...f, label: out[i++] ?? f.label })),
    schedule: p.schedule.map((s) => ({ ...s, reason: out[i++] ?? s.reason })),
    savings: p.savings
      ? {
          ...p.savings,
          vsBaseline: out[i++] ?? p.savings.vsBaseline,
          provenance: out[i++] ?? p.savings.provenance,
        }
      : null,
    soilNote: out[i++] ?? p.soilNote,
  }));
}
