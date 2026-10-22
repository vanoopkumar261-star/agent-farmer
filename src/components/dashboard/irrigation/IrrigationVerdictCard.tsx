"use client";

/**
 * The one answer the page exists to give: water today, or don't.
 *
 * The verdict leads, the numbers back it, and the reasoning is listed
 * underneath — the same shape as the farm-health score's explainable factors,
 * for the same reason. A farmer asked to run a pump for two hours should be
 * able to see which inputs produced that, and disagree with one.
 */

import { Droplets, PauseCircle, CloudRain, Sprout, CloudOff, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SEVERITY, SEVERITY_INK } from "@/lib/chartTheme";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan, IrrigationStatus } from "@/lib/irrigation";

/**
 * Status → the hazard ramp, and the key that names it.
 *
 * The ramp is re-used rather than inventing a second scale. The wording is a
 * dictionary key rather than a literal because `status` is a union member, not
 * a sentence — the engine decides which band applies, this file decides how to
 * say it, and `src/lib/i18n/dashboard.ts` decides that in nine languages.
 */
const STATUS_BAND: Record<IrrigationStatus, { key: keyof typeof SEVERITY; k: string }> = {
  optimal: { key: "clear", k: "irrigation.status.optimal" },
  deficit: { key: "yellow", k: "irrigation.status.deficit" },
  critical: { key: "red", k: "irrigation.status.critical" },
  over_irrigated: { key: "orange", k: "irrigation.status.overIrrigated" },
};

const VERDICT = {
  irrigate_today: { Icon: Droplets, k: "irrigation.verdict.irrigateToday", tone: "primary" as const },
  hold: { Icon: PauseCircle, k: "irrigation.verdict.hold", tone: "sage" as const },
  rain_coming: { Icon: CloudRain, k: "irrigation.verdict.rainComing", tone: "ai" as const },
  no_crop: { Icon: Sprout, k: "irrigation.verdict.noCrop", tone: "neutral" as const },
  no_data: { Icon: CloudOff, k: "irrigation.verdict.noData", tone: "neutral" as const },
};

function formatLitres(l: number): string {
  if (l >= 1_000_000) return `${(l / 1_000_000).toFixed(1)}M L`;
  if (l >= 1000) return `${Math.round(l / 1000).toLocaleString("en-IN")}k L`;
  return `${Math.round(l)} L`;
}

export function formatRun(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default function IrrigationVerdictCard({ plan }: { plan: IrrigationPlan }) {
  const { t } = useT();
  const v = VERDICT[plan.verdict];
  const band = STATUS_BAND[plan.status];
  const showNumbers = plan.verdict === "irrigate_today" && plan.volumeLitres > 0;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-af-sage text-af-primary shrink-0">
            <v.Icon className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-af-ink">{t(v.k)}</h2>
            <p className="mt-0.5 text-sm text-af-ink-2">
              {[
                t("farmCard.title", { n: plan.farmIndex }),
                plan.cropName,
                plan.stage &&
                  t("irrigation.verdict.dayStage", {
                    day: plan.stage.day,
                    stage: plan.stage.label.toLowerCase(),
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/*
          The severity ramp never carries meaning on colour alone — its own
          docstring makes that a rule, because yellow sits at 2.15 contrast and
          is only legible next to its label.
        */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{ backgroundColor: SEVERITY[band.key], color: SEVERITY_INK[band.key] }}
        >
          {plan.status === "critical" || plan.status === "over_irrigated" ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : null}
          {t(band.k)}
        </span>
      </div>

      {showNumbers && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[14px] bg-af-bg border border-af-border p-4">
          <Figure
            label={t("irrigation.figure.apply")}
            value={`${plan.grossMm} mm`}
            meta={t("irrigation.figure.toRoots", { mm: plan.needMm })}
          />
          <Figure
            label={t("irrigation.figure.thatIs")}
            value={formatLitres(plan.volumeLitres)}
            meta={t("irrigation.figure.overAcres", { acres: plan.areaAcres })}
          />
          <Figure
            label={t("irrigation.figure.runFor")}
            value={formatRun(plan.runMinutes)}
            meta={
              plan.efficiencyAssumed
                ? t("irrigation.figure.assumedSystem")
                : t("irrigation.figure.efficient", { pct: Math.round(plan.efficiency * 100) })
            }
          />
        </div>
      )}

      <ul className="mt-5 space-y-2">
        {plan.factors.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-af-ink-2">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  f.delta == null || f.delta === 0
                    ? "#7C8A78"
                    : f.delta > 0
                      ? SEVERITY.clear
                      : SEVERITY.orange,
              }}
            />
            {f.label}
          </li>
        ))}
      </ul>

      {plan.regime === "irrigated" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="neutral">{plan.irrigationLabel}</Badge>
          {plan.ponded && <Badge tone="ai">{t("irrigation.badge.standingWater")}</Badge>}
        </div>
      )}
    </Card>
  );
}

function Figure({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-af-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-af-muted">{meta}</div>
    </div>
  );
}
