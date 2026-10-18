"use client";

/**
 * The week's watering plan: which days, how much, how long.
 *
 * Each row says why it is there. A schedule a farmer cannot interrogate is one
 * they will either follow blindly or ignore entirely, and both are worse than
 * one they can argue with.
 */

import { CalendarDays, Droplets, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan } from "@/lib/irrigation";
import { formatRun } from "./IrrigationVerdictCard";

export default function IrrigationSchedule({ plan }: { plan: IrrigationPlan }) {
  const { t } = useT();
  const firstISO = plan.forecast[0]?.dateISO;

  const dayLabel = (dateISO: string, weekday: string, index: number): string => {
    // "Today" already exists as a translated key on the weather card; reusing it
    // keeps one word from being translated twice, differently.
    if (index === 0) return t("weatherCard.today");
    return `${weekday} ${new Date(dateISO).getDate()}`;
  };

  const cropName = plan.cropName ?? t("irrigation.thisCrop");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-4 h-4 text-af-muted" />
        <h3 className="font-semibold text-af-ink">{t("irrigation.schedule.title")}</h3>
      </div>

      {plan.schedule.length === 0 ? (
        // Nothing to do is a real answer, and saying so plainly is better than
        // an empty panel that looks like the feature failed to run.
        <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-af-bg border border-af-border p-4">
          <CheckCircle2 className="w-4 h-4 text-af-primary shrink-0 mt-0.5" />
          {/*
            Two whole sentences rather than one with an appended clause: a
            trailing ", and rain is forecast" does not survive translation as a
            fragment, and Hindi puts the conjunction in a different place.
          */}
          <div className="text-sm text-af-ink-2">
            {plan.forecast.some((d) => d.rainMm >= 2)
              ? t("irrigation.schedule.noneRain", { crop: cropName })
              : t("irrigation.schedule.none", { crop: cropName })}
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-af-ink-2 mb-4">
            {[
              plan.schedule.length === 1
                ? t("irrigation.schedule.plannedOne")
                : t("irrigation.schedule.plannedMany", { n: plan.schedule.length }),
              plan.efficiencyAssumed && t("irrigation.schedule.runTimesAssumed"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ol className="space-y-2.5">
            {plan.schedule.map((s) => {
              const idx = plan.forecast.findIndex((f) => f.dateISO === s.dateISO);
              const today = s.dateISO === firstISO;
              return (
                <li
                  key={s.dateISO}
                  className={`rounded-[14px] border p-4 ${
                    today ? "border-af-primary/40 bg-af-primary/5" : "border-af-border bg-af-bg"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-af-primary" />
                      <span className="font-semibold text-af-ink">
                        {dayLabel(s.dateISO, s.weekday, idx)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-af-ink">{s.grossMm} mm</span>
                      <span className="text-af-ink-2">
                        {Math.round(s.volumeLitres).toLocaleString("en-IN")} L
                      </span>
                      <span className="text-af-ink-2">{formatRun(s.runMinutes)}</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-af-muted">{s.reason}</p>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}
