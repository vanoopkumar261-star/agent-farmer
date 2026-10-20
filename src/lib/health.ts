/**
 * Farm-health score computed from real signals — replaces the old constant
 * `health = 72 + progress*14`. The score starts at 100 and is reduced by
 * concrete stressors (heat at sensitive stages, rain in the harvest window,
 * frost, overdue tasks), each recorded as an explainable factor so the number
 * can be justified rather than asserted.
 */
import type { WeatherData } from "./weather";
import type { FarmWithCrop } from "./dashboard";
import { cropStageFor, getCropProfile, isRainFed } from "./agronomy";
import type { Msg } from "./i18n/config";
import { translate } from "./i18n/dictionaries";

/** `label` is English (for logs/AI context); the UI renders `msg`. */
export type HealthFactor = { label: string; msg: Msg; delta: number };

function factor(k: string, delta: number, p?: Msg["p"]): HealthFactor {
  return { label: translate("en", k, p), msg: { k, p }, delta };
}

export type FarmHealth = {
  score: number; // 40..100
  band: "good" | "watch" | "risk";
  factors: HealthFactor[];
  note: string;
  noteMsg: Msg;
};

export function computeFarmHealth({
  farms,
  weather,
  overdueTasks = 0,
  activeDiseases = 0,
}: {
  farms: FarmWithCrop[];
  weather: WeatherData | null;
  /** Tasks generated yesterday that were never ticked. */
  overdueTasks?: number;
  /** Recent leaf scans that came back diseased. */
  activeDiseases?: number;
}): FarmHealth {
  const cropped = farms.filter((f) => f.crop);
  const factors: HealthFactor[] = [];
  let score = 100;

  if (cropped.length === 0) {
    return {
      score: 80,
      band: "watch",
      factors: [],
      note: translate("en", "health.note.noCrops"),
      noteMsg: { k: "health.note.noCrops" },
    };
  }

  if (weather) {
    // Heat stress at a sensitive stage, per crop.
    let heatHit = false;
    for (const f of cropped) {
      const p = getCropProfile(f.crop!.chosen_crop);
      const st = cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
      const sensitive = st.label === "Flowering" || st.label === "Vegetative";
      if (sensitive && weather.current.temp >= p.heatThreshold && !heatHit) {
        score -= 12;
        factors.push(factor("health.heat", -12, { crop: f.crop!.chosen_crop, stage: st.label.toLowerCase() }));
        heatHit = true; // count once
      }
    }

    // Rain in the next 3 days — worse if a crop is maturing (harvest/spoilage risk).
    const rainSoon = weather.daily.slice(0, 3).some((d) => d.precipProb >= 50);
    if (rainSoon) {
      const maturing = cropped.some(
        (f) =>
          cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date)
            .label === "Maturity"
      );
      if (maturing) {
        score -= 10;
        factors.push(factor("health.rainHarvest", -10));
      } else {
        score -= 3;
        factors.push(factor("health.rainOps", -3));
      }
    }

    // Frost / cold snap.
    const frost = weather.daily.slice(0, 3).some((d) => d.tMin <= 4);
    if (frost) {
      score -= 8;
      factors.push(factor("health.frost", -8));
    }
  } else {
    factors.push(factor("health.weatherSyncing", 0));
  }

  // Water risk: a thirsty crop on a rain-fed plot with no rain coming has no
  // fallback, which is a materially different position from the same crop on a
  // borewell. Only counted once, however many plots qualify.
  if (weather) {
    const noRainAhead = !weather.daily.slice(0, 3).some((d) => d.precipProb >= 40);
    const thirstyRainFed = cropped.find((f) => {
      const p = getCropProfile(f.crop!.chosen_crop);
      const st = cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
      const growing = st.label === "Vegetative" || st.label === "Flowering";
      return p.waterHeavy && growing && isRainFed(f.irrigation);
    });
    if (noRainAhead && thirstyRainFed) {
      score -= 7;
      factors.push(factor("health.noRainThirsty", -7, { crop: thirstyRainFed.crop!.chosen_crop }));
    }
  }

  // Unresolved disease is the most direct evidence we have of poor health, so
  // it outweighs any single weather signal.
  if (activeDiseases > 0) {
    const d = Math.min(20, activeDiseases * 10);
    score -= d;
    factors.push(factor(activeDiseases > 1 ? "health.diseaseMany" : "health.diseaseOne", -d, { n: activeDiseases }));
  }

  if (overdueTasks > 0) {
    const d = Math.min(15, overdueTasks * 3);
    score -= d;
    factors.push(factor(overdueTasks > 1 ? "health.missedMany" : "health.missedOne", -d, { n: overdueTasks }));
  }

  // Nothing wrong is itself worth saying — otherwise a perfect score looks
  // like the feature simply failed to run.
  if (factors.length === 0) {
    factors.push(factor("health.allClear", 0));
  }

  score = Math.max(40, Math.min(100, Math.round(score)));
  const band = score >= 78 ? "good" : score >= 60 ? "watch" : "risk";
  const noteMsg: Msg = { k: `health.note.${band}` };

  return { score, band, factors, note: translate("en", noteMsg.k), noteMsg };
}
