/**
 * Weather + crop-stage aware alerts. Every alert is grounded in a real forecast
 * signal and the crop's actual growth stage — no fabricated "AI confidence"
 * lines. Returns an empty list when there's genuinely nothing to flag.
 */
import type { WeatherData } from "./weather";
import type { FarmWithCrop } from "./dashboard";
import type { Alert } from "@/components/dashboard/AlertsCard";
import { cropStageFor, getCropProfile } from "./agronomy";
import type { Msg } from "./i18n/config";
import { translate } from "./i18n/dictionaries";

/** An alert in both forms: Msg for the UI, English title/body for notifications. */
function alert(kind: Alert["kind"], titleMsg: Msg, bodyMsg: Msg): Alert {
  return {
    kind,
    title: translate("en", titleMsg.k, titleMsg.p),
    body: translate("en", bodyMsg.k, bodyMsg.p),
    titleMsg,
    bodyMsg,
  };
}

export function deriveAlerts({
  farms,
  weather,
  missedYesterday,
}: {
  farms: FarmWithCrop[];
  weather: WeatherData | null;
  /** Yesterday's task tally, so unfinished work carries forward instead of vanishing. */
  missedYesterday?: { total: number; done: number; missed: number };
}): Alert[] {
  const alerts: Alert[] = [];
  const cropped = farms.filter((f) => f.crop);

  // Unfinished work leads, ahead of weather — it is the thing the farmer can
  // still act on today. Shown before the `!weather` bail-out so it survives a
  // failed forecast fetch.
  if (missedYesterday && missedYesterday.missed > 0) {
    const { missed, total } = missedYesterday;
    alerts.push(
      alert(
        missed >= total ? "critical" : "task",
        { k: total > 1 ? "alert.missed.titleMany" : "alert.missed.titleOne", p: { missed, total } },
        { k: "alert.missed.body", p: { done: missedYesterday.done, total } }
      )
    );
  }

  if (!weather) return alerts;

  const rainSoon = weather.daily.slice(0, 3).some((d) => d.precipProb >= 50);
  const maturing = cropped.find(
    (f) =>
      cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date)
        .label === "Maturity"
  );

  if (rainSoon) {
    if (maturing) {
      alerts.push(
        alert(
          "critical",
          { k: "alert.rainHarvest.title" },
          { k: "alert.rainHarvest.body", p: { crop: maturing.crop!.chosen_crop, fi: maturing.farm_index } }
        )
      );
    } else {
      alerts.push(alert("weather", { k: "alert.rain.title" }, { k: "alert.rain.body" }));
    }
  }

  // Heat stress at a sensitive stage (one alert is enough).
  for (const f of cropped) {
    const p = getCropProfile(f.crop!.chosen_crop);
    const st = cropStageFor(f.crop!.chosen_crop, f.crop!.seeding_date, f.crop!.estimated_harvest_date);
    if ((st.label === "Flowering" || st.label === "Vegetative") && weather.current.temp >= p.heatThreshold) {
      alerts.push(
        alert(
          "critical",
          { k: "alert.heat.title", p: { crop: f.crop!.chosen_crop } },
          { k: "alert.heat.body", p: { temp: weather.current.temp, stage: st.label.toLowerCase(), fi: f.farm_index } }
        )
      );
      break;
    }
  }

  // Cold / frost.
  const frost = weather.daily.slice(0, 3).some((d) => d.tMin <= 4);
  if (frost) {
    alerts.push(alert("weather", { k: "alert.frost.title" }, { k: "alert.frost.body" }));
  }

  return alerts;
}
