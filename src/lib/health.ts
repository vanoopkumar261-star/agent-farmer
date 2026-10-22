/**
 * Farm-health score.
 *
 * ── Why the number used to be 100, and why that was the bug ──────────────────
 *
 * The first version replaced a hardcoded `72 + progress*14` with something
 * real: start at 100, subtract for concrete stressors (heat at a sensitive
 * stage, rain in the harvest window, frost, overdue tasks, active disease).
 * That was an improvement, but it left a worse problem in plain sight — a farm
 * with no *event* against it scored exactly 100, every day, for ever.
 *
 * "How can farm health always be 100%?" is the right question to ask of that,
 * and the honest answer is that it cannot. 100 asserts that every growing
 * condition is ideal, which is a claim about temperature, soil moisture,
 * humidity, wind, pH and the water in the root zone — none of which the old
 * score ever looked at. A farm is not healthy because nothing has gone wrong
 * yet; it is healthy when the conditions the crop is actually standing in are
 * close to what that crop wants.
 *
 * ── How the number is built now ──────────────────────────────────────────────
 *
 * Two parts, and they answer different questions:
 *
 *   CONDITIONS (the base) — six measured signals, each scored 0..1 against the
 *     band that crop grows best in, then combined as a weighted mean. This is
 *     "how good is it to be this crop in this field right now", and it moves
 *     every day because weather does.
 *
 *     The ideal plateau for each signal is deliberately NARROW — the genuine
 *     agronomic optimum, not "anything not obviously bad". A first cut used
 *     comfortable wide bands and a perfectly ordinary day still scored 100,
 *     which is the exact complaint this rewrite exists to answer. With tight
 *     plateaus a good day lands in the 90s, a textbook day can still reach 100,
 *     and 100 means something again because it is rare.
 *
 *   EVENTS (deductions) — things that have gone wrong and need acting on:
 *     disease found, tasks missed, frost or harvest-window rain forecast. These
 *     subtract from the base, because a farm in perfect conditions with a
 *     diseased crop is not a healthy farm.
 *
 * Every signal that has no reading is simply left out of the mean rather than
 * scored as bad. A farmer with no pH reading and no soil sensor still gets a
 * fair score from weather alone — and `coverage` says how much of the picture
 * the number is actually based on, so the UI can be honest about it rather than
 * presenting a two-signal guess as if it were a full assessment.
 *
 * ── Provenance ───────────────────────────────────────────────────────────────
 *
 * The comfort bands are general agronomic ranges for Indian field conditions,
 * with the pH band taken per-crop from `phMin`/`phMax` in agronomy.ts and the
 * heat band anchored on that crop's own `heatThreshold`. They describe a
 * well-managed field, not a measurement of anyone's plot.
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

/** The six measured growing conditions behind the base score. */
export type ConditionKey =
  | "temperature"
  | "moisture"
  | "humidity"
  | "wind"
  | "ph"
  | "water";

export type HealthCondition = {
  key: ConditionKey;
  /** The reading itself, in `unit`. Null when nothing reports it. */
  value: number | null;
  unit: string;
  /** 0..1 — how close this reading is to ideal for the crop in the ground. */
  score: number | null;
  /** Points this condition cost the base score. 0 when ideal or unmeasured. */
  delta: number;
  /** "good" | "watch" | "risk", for the dot next to the reading. */
  band: "good" | "watch" | "risk" | "unknown";
  label: string;
  msg: Msg;
  /** Where the reading came from, so the UI never implies a sensor that is absent. */
  source: "sensor" | "weather" | "reading" | "model" | null;
};

export type FarmHealth = {
  score: number; // 40..100
  band: "good" | "watch" | "risk";
  factors: HealthFactor[];
  /** The measured conditions, including the ones with no reading. */
  conditions: HealthCondition[];
  /** 0..1 — share of the six signals that actually had a reading. */
  coverage: number;
  note: string;
  noteMsg: Msg;
};

/**
 * Trapezoid scoring: full marks inside [idealLo, idealHi], falling linearly to
 * zero at hardLo / hardHi.
 *
 * A step function would make the score jump a whole band when a reading moves
 * by 0.1 °C, which reads as instability rather than precision; a linear ramp
 * means a farm drifting towards trouble can be seen drifting.
 */
function bandScore(
  value: number,
  hardLo: number,
  idealLo: number,
  idealHi: number,
  hardHi: number
): number {
  if (value >= idealLo && value <= idealHi) return 1;
  if (value <= hardLo || value >= hardHi) return 0;
  return value < idealLo
    ? (value - hardLo) / (idealLo - hardLo)
    : (hardHi - value) / (hardHi - idealHi);
}

/**
 * Relative importance of each condition in the base score.
 *
 * Water and soil moisture lead because they are what actually kills a crop
 * inside a week; wind is last because except in a storm it mostly affects
 * spraying rather than the plant. Weights are renormalised over whichever
 * signals have readings, so a farm with no sensors is not punished for it.
 */
const WEIGHTS: Record<ConditionKey, number> = {
  water: 1.2,
  moisture: 1.2,
  temperature: 1.0,
  ph: 1.0,
  humidity: 0.8,
  wind: 0.6,
};

/** Readings the dashboard can supply, all optional. */
export type HealthSignals = {
  /** Field-sensor readings (ThingSpeak/ESP32), when a channel is configured. */
  sensors?: {
    temperature?: number | null;
    humidity?: number | null;
    soilMoisture?: number | null;
  } | null;
  /** Latest logged soil-pH reading for the holding. */
  soilPh?: number | null;
  /**
   * Root-zone water remaining as a percentage of available capacity, from the
   * irrigation engine (`IrrigationPlan.availablePct`). Averaged across plots by
   * the caller, since the score is for the holding.
   */
  availableWaterPct?: number | null;
};

function conditionBand(score: number | null): HealthCondition["band"] {
  if (score === null) return "unknown";
  return score >= 0.8 ? "good" : score >= 0.5 ? "watch" : "risk";
}

export function computeFarmHealth({
  farms,
  weather,
  overdueTasks = 0,
  activeDiseases = 0,
  signals = {},
}: {
  farms: FarmWithCrop[];
  weather: WeatherData | null;
  /** Tasks generated yesterday that were never ticked. */
  overdueTasks?: number;
  /** Recent leaf scans that came back diseased. */
  activeDiseases?: number;
  signals?: HealthSignals;
}): FarmHealth {
  const cropped = farms.filter((f) => f.crop);
  const factors: HealthFactor[] = [];

  if (cropped.length === 0) {
    return {
      score: 80,
      band: "watch",
      factors: [],
      conditions: [],
      coverage: 0,
      note: translate("en", "health.note.noCrops"),
      noteMsg: { k: "health.note.noCrops" },
    };
  }

  // The crop the conditions are judged against. With several plots this is the
  // first cropped one — the bands differ only modestly between field crops, and
  // a per-plot score already exists on the crops page.
  const lead = cropped[0].crop!;
  const profile = getCropProfile(lead.chosen_crop);

  /* ── 1. Conditions: the base score ──────────────────────────────────────── */

  const conditions: HealthCondition[] = [];

  const add = (
    key: ConditionKey,
    value: number | null,
    unit: string,
    source: HealthCondition["source"],
    score: number | null,
    msgKey: string,
    params?: Msg["p"]
  ) => {
    conditions.push({
      key,
      value,
      unit,
      score,
      delta: 0, // filled in once the weights are normalised
      band: conditionBand(score),
      label: translate("en", msgKey, params),
      msg: { k: msgKey, p: params },
      source,
    });
  };

  // Temperature — sensor first, since it is the air the crop is actually in.
  const temp = signals.sensors?.temperature ?? weather?.current.temp ?? null;
  if (temp !== null) {
    // Comfortable up to the crop's own heat threshold, failing 6 °C past it;
    // cold end is generic, since frost is handled as an event below.
    add(
      "temperature",
      temp,
      "°C",
      signals.sensors?.temperature != null ? "sensor" : "weather",
      // Ideal tops out well below the stress threshold: a wheat crop at 29 °C
      // is not suffering, but it is not in its best conditions either.
      bandScore(temp, 5, 20, Math.min(28, profile.heatThreshold - 5), profile.heatThreshold + 6),
      "health.cond.temperature",
      { value: Math.round(temp), crop: profile.displayName }
    );
  } else {
    add("temperature", null, "°C", null, null, "health.cond.temperature.none");
  }

  // Soil moisture — only ever from hardware. There is no way to infer it.
  const sm = signals.sensors?.soilMoisture ?? null;
  if (sm !== null) {
    add(
      "moisture",
      sm,
      "%",
      "sensor",
      // Field capacity for most Indian field soils sits near 45-58%. Below 20%
      // the crop is in stress; above 85% the roots are drowning.
      bandScore(sm, 10, 45, 58, 92),
      "health.cond.moisture",
      { value: Math.round(sm) }
    );
  } else {
    add("moisture", null, "%", null, null, "health.cond.moisture.none");
  }

  // Humidity — both ends matter: dry air drives transpiration past what the
  // roots can supply, and sustained high humidity is what fungal disease needs.
  const rh = signals.sensors?.humidity ?? weather?.current.humidity ?? null;
  if (rh !== null) {
    add(
      "humidity",
      rh,
      "%",
      signals.sensors?.humidity != null ? "sensor" : "weather",
      bandScore(rh, 10, 50, 65, 98),
      "health.cond.humidity",
      { value: Math.round(rh) }
    );
  } else {
    add("humidity", null, "%", null, null, "health.cond.humidity.none");
  }

  // Wind — calm is ideal. Spraying becomes wasteful past ~15 km/h and lodging
  // risk starts around 35-40 km/h for a tall standing crop.
  const wind = weather?.current.windKph ?? null;
  if (wind !== null) {
    add("wind", wind, "km/h", "weather", bandScore(wind, -1, 0, 10, 45), "health.cond.wind", {
      value: Math.round(wind),
    });
  } else {
    add("wind", null, "km/h", null, null, "health.cond.wind.none");
  }

  // pH — judged against the crop standing in the field, not a generic range.
  const ph = signals.soilPh ?? null;
  if (ph !== null) {
    add(
      "ph",
      ph,
      "",
      "reading",
      // Full marks only in the middle 40% of the crop's range; the edges of
      // that range are tolerable, not optimal.
      bandScore(
        ph,
        profile.phMin - 1.5,
        profile.phMin + (profile.phMax - profile.phMin) * 0.3,
        profile.phMax - (profile.phMax - profile.phMin) * 0.3,
        profile.phMax + 1.5
      ),
      "health.cond.ph",
      { value: ph.toFixed(1), crop: profile.displayName }
    );
  } else {
    add("ph", null, "", null, null, "health.cond.ph.none");
  }

  // Root-zone water. Paddy is excluded: it is grown ponded, so "available
  // water" is not the quantity that describes it and would read as waterlogged.
  const awp = signals.availableWaterPct ?? null;
  if (awp !== null && !profile.water.ponded) {
    add(
      "water",
      awp,
      "%",
      "model",
      // Below the crop's depletion trigger it is already losing yield, so that
      // is the zero end. Full marks only in the top fifth of the reservoir —
      // between the two the crop is drawing down and the farmer should know.
      bandScore(awp, (1 - profile.water.depletionFraction) * 100, 80, 100, 101),
      "health.cond.water",
      { value: Math.round(awp) }
    );
  } else {
    add("water", null, "%", null, null, "health.cond.water.none");
  }

  // Weighted mean over the signals that actually reported.
  const measured = conditions.filter((c) => c.score !== null);
  const totalWeight = measured.reduce((s, c) => s + WEIGHTS[c.key], 0);
  const coverage = measured.length / conditions.length;

  let base: number;
  if (totalWeight === 0) {
    // Nothing measurable at all — a brand-new account before the first weather
    // fetch. Assert nothing: a neutral base, and the UI says why.
    base = 85;
    factors.push(factor("health.weatherSyncing", 0));
  } else {
    const mean = measured.reduce((s, c) => s + c.score! * WEIGHTS[c.key], 0) / totalWeight;
    base = mean * 100;
    // Attribute the shortfall back to each condition, so the panel adds up.
    for (const c of measured) {
      c.delta = -Math.round((1 - c.score!) * (WEIGHTS[c.key] / totalWeight) * 100);
    }
  }

  /* ── 2. Events: deductions for things to act on ─────────────────────────── */

  let score = base;

  if (weather) {
    // Heat stress at a sensitive stage, per crop. Counted once however many
    // plots qualify — it is one weather system over one holding.
    let heatHit = false;
    for (const f of cropped) {
      const p = getCropProfile(f.crop!.chosen_crop);
      const st = cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
      const sensitive = st.label === "Flowering" || st.label === "Vegetative";
      if (sensitive && weather.current.temp >= p.heatThreshold && !heatHit) {
        score -= 12;
        factors.push(factor("health.heat", -12, { crop: f.crop!.chosen_crop, stage: st.label.toLowerCase() }));
        heatHit = true;
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

    // Water risk: a thirsty crop on a rain-fed plot with no rain coming has no
    // fallback, which is a materially different position from the same crop on
    // a borewell. Only counted once, however many plots qualify.
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

  // Nothing wrong is itself worth saying — otherwise a clean run of events
  // looks like the feature simply failed to produce any.
  if (factors.length === 0) {
    factors.push(factor("health.allClear", 0));
  }

  score = Math.max(40, Math.min(100, Math.round(score)));
  const band = score >= 78 ? "good" : score >= 60 ? "watch" : "risk";
  const noteMsg: Msg = { k: `health.note.${band}` };

  return {
    score,
    band,
    factors,
    conditions,
    coverage,
    note: translate("en", noteMsg.k),
    noteMsg,
  };
}
