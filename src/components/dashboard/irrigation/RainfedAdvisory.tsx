"use client";

/**
 * What a rain-fed farm gets instead of a schedule.
 *
 * Deliberately not a locked teaser. A farmer with no borewell still needs to
 * know when their crop will run short — that is arguably the group with the
 * most at stake, since they have no fallback — so the same water balance runs
 * and reports the stress days it finds. The conversion panel sits underneath,
 * where it can make a concrete case with a real number rather than a slogan.
 */

import { CloudRain, TriangleAlert, Sprout, Droplets } from "lucide-react";
import Card from "@/components/ui/Card";
import { SEVERITY } from "@/lib/chartTheme";
import { useT } from "@/components/i18n/LanguageProvider";
import { rainfedOutlook, type IrrigationPlan } from "@/lib/irrigation";
import MoistureForecastChart from "./MoistureForecastChart";

export default function RainfedAdvisory({ plan }: { plan: IrrigationPlan }) {
  const { t } = useT();
  const o = rainfedOutlook(plan);
  const rainTotal = plan.forecast.reduce((s, d) => s + d.rainMm, 0);
  const worstDay = o.worstDate
    ? plan.forecast.find((d) => d.dateISO === o.worstDate)
    : null;

  const cropName = plan.cropName ?? t("irrigation.thisCrop");
  const cropNameCap = plan.cropName ?? t("irrigation.thisCropCap");

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CloudRain className="w-4 h-4 text-af-muted" />
          <h3 className="font-semibold text-af-ink">{t("irrigation.rainfed.title")}</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label={t("irrigation.rainfed.rainExpected")}
            value={`${Math.round(rainTotal)} mm`}
            meta={t("irrigation.rainfed.next7")}
          />
          <Stat
            label={t("irrigation.rainfed.stressDays")}
            value={String(o.stressDays)}
            meta={
              o.stressDays === 0
                ? t("irrigation.rainfed.noneForecast")
                : t("irrigation.rainfed.belowComfort")
            }
            accent={o.stressDays > 0 ? SEVERITY.orange : undefined}
          />
          <Stat
            label={t("irrigation.rainfed.shortfall")}
            value={`${o.deficitMm} mm`}
            meta={t("irrigation.rainfed.shortfallMeta")}
            accent={o.deficitMm > 0 ? SEVERITY.orange : undefined}
          />
        </div>

        {o.stressDays === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-[14px] bg-af-bg border border-af-border p-4">
            <Sprout className="w-4 h-4 text-af-primary shrink-0 mt-0.5" />
            <p className="text-sm text-af-ink-2">
              {rainTotal >= 5
                ? t("irrigation.rainfed.okayRain", { crop: cropName })
                : t("irrigation.rainfed.okay", { crop: cropName })}
            </p>
          </div>
        ) : (
          <div
            className="mt-4 flex items-start gap-3 rounded-[14px] border p-4"
            style={{ borderColor: SEVERITY.orange, backgroundColor: `${SEVERITY.orange}12` }}
          >
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: SEVERITY.orange }} />
            <div className="text-sm text-af-ink-2">
              <p>
                {t("irrigation.rainfed.short", {
                  crop: cropNameCap,
                  days: o.stressDays,
                })}
                {worstDay
                  ? ` ${t("irrigation.rainfed.worstDay", { worstDay: worstDay.weekday })}`
                  : ""}
              </p>
              {/*
                Matched against the English literal on purpose: `stage.label` is
                deliberately left untranslated by `localiseIrrigationPlans`,
                precisely so this check — the one that warns about the costliest
                stage to run dry — cannot be switched off by a translation.
              */}
              {plan.stage?.label === "Flowering" && (
                <p className="mt-1 font-semibold">{t("irrigation.rainfed.flowering")}</p>
              )}
              <p className="mt-1">{t("irrigation.rainfed.conserve")}</p>
            </div>
          </div>
        )}
      </Card>

      {/* The same curve an irrigated farm sees, minus the schedule. */}
      <MoistureForecastChart plan={plan} sensorPct={null} sensorAt={null} />

      {o.deficitMm > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-af-primary" />
            <h3 className="font-semibold text-af-ink">
              {t("irrigation.rainfed.whatChanges")}
            </h3>
          </div>
          <p className="text-sm text-af-ink-2">
            {t("irrigation.rainfed.potential", {
              crop: cropName,
              litres: Math.round(o.potentialLitres).toLocaleString("en-IN"),
              acres: plan.areaAcres,
              mm: o.deficitMm,
            })}
          </p>
          <p className="mt-2 text-xs text-af-muted">
            {t("irrigation.rainfed.potentialNote")}
          </p>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  meta,
  accent,
}: {
  label: string;
  value: string;
  meta: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[14px] bg-af-bg border border-af-border p-4">
      <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-af-muted">{meta}</div>
    </div>
  );
}
