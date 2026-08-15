/**
 * Farm-health score computed from real signals — replaces the old constant
 * `health = 72 + progress*14`. The score starts at 100 and is reduced by
 * concrete stressors (heat at sensitive stages, rain in the harvest window,
 * frost, overdue tasks), each recorded as an explainable factor so the number
 * can be justified rather than asserted.
 */
import type { WeatherData } from "./weather";
import type { FarmWithCrop } from "./dashboard";
import { cropStageFor, getCropProfile } from "./agronomy";

export type HealthFactor = { label: string; delta: number };

export type FarmHealth = {
  score: number; // 40..100
  band: "good" | "watch" | "risk";
  factors: HealthFactor[];
  note: string;
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
      note: "No crops seeded yet — register a crop to start health tracking.",
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
        factors.push({
          label: `Heat stress risk — ${f.crop!.chosen_crop} at ${st.label.toLowerCase()}`,
          delta: -12,
        });
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
        factors.push({ label: "Rain forecast during a harvest window", delta: -10 });
      } else {
        score -= 3;
        factors.push({ label: "Rain forecast — field operations constrained", delta: -3 });
      }
    }

    // Frost / cold snap.
    const frost = weather.daily.slice(0, 3).some((d) => d.tMin <= 4);
    if (frost) {
      score -= 8;
      factors.push({ label: "Cold/frost risk in the forecast", delta: -8 });
    }
  } else {
    factors.push({ label: "Weather data syncing", delta: 0 });
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
      return p.waterHeavy && growing && /rain[\s-]?fed/i.test(f.irrigation ?? "");
    });
    if (noRainAhead && thirstyRainFed) {
      score -= 7;
      factors.push({
        label: `No rain forecast — ${thirstyRainFed.crop!.chosen_crop} is rain-fed and thirsty`,
        delta: -7,
      });
    }
  }

  // Unresolved disease is the most direct evidence we have of poor health, so
  // it outweighs any single weather signal.
  if (activeDiseases > 0) {
    const d = Math.min(20, activeDiseases * 10);
    score -= d;
    factors.push({
      label: `${activeDiseases} recent scan${activeDiseases > 1 ? "s" : ""} found disease`,
      delta: -d,
    });
  }

  if (overdueTasks > 0) {
    const d = Math.min(15, overdueTasks * 3);
    score -= d;
    factors.push({
      label: `${overdueTasks} task${overdueTasks > 1 ? "s" : ""} missed yesterday`,
      delta: -d,
    });
  }

  // Nothing wrong is itself worth saying — otherwise a perfect score looks
  // like the feature simply failed to run.
  if (factors.length === 0) {
    factors.push({ label: "No heat, rain, frost or disease risk detected", delta: 0 });
  }

  score = Math.max(40, Math.min(100, Math.round(score)));
  const band = score >= 78 ? "good" : score >= 60 ? "watch" : "risk";
  const note =
    band === "good"
      ? "Your farms are in great shape."
      : band === "watch"
      ? "Healthy, with a few items to watch."
      : "Needs attention — check alerts.";

  return { score, band, factors, note };
}
