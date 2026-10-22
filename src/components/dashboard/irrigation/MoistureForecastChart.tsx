"use client";

/**
 * Seven days of soil water, forecast forward.
 *
 * The series is *available water* as a percentage of what the root zone can
 * hold, not depletion in millimetres — a farmer reads "the field is at 40%"
 * far faster than "depletion is 52 mm", and the refill point becomes a line to
 * stay above rather than one to stay below.
 *
 * ── Why two lines rather than a curve over rain bars ─────────────────────────
 * This was a Recharts ComposedChart: an area for soil water with rainfall as
 * bars behind it. It is a Bklit line chart now, and rainfall became a second
 * line on its own right-hand scale. The relationship the chart exists to show
 * — rain goes up, the curve stops falling, nobody pumps anything — reads at
 * least as well from two lines crossing as it did from a curve over bars, and
 * the farmer gets Bklit's crosshair: one hover, both numbers, same day.
 *
 * The refill point is drawn by `Grid highlightRowValues`, which is the library's
 * own idiom for a threshold row, rather than a ReferenceLine of our own.
 */

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import Card from "@/components/ui/Card";
import { useChartTheme } from "@/components/theme/useChartTheme";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan } from "@/lib/irrigation";

export default function MoistureForecastChart({
  plan,
  sensorPct,
  sensorAt,
}: {
  plan: IrrigationPlan;
  sensorPct: number | null;
  sensorAt: string | null;
}) {
  const { SERIES, CATEGORICAL, SEVERITY, GRID } = useChartTheme();
  /*
    Soil water is the crop's own state, so it takes the crop green; rain is
    what arrives from the sky, so it keeps the blue. They were both blue when
    one of them was drawn as bars — as two lines that reads as one series
    rendered twice.
  */
  const SOIL = CATEGORICAL[0];
  const RAIN = CATEGORICAL[2];
  const { t } = useT();

  if (!plan.forecast.length) return null;

  // The trigger line, expressed on the same axis as the curve. For drip this
  // sits well above RAW because the system tops up little and often.
  const triggerPct = Math.round(((plan.taw - plan.triggerMm) / Math.max(1, plan.taw)) * 100);

  // Bklit's x-scale is a time scale, so the day has to be a real Date rather
  // than the weekday label Recharts was given. `dateISO` was already on every
  // forecast row; nothing new is computed here.
  const data = plan.forecast.map((d) => ({
    date: new Date(d.dateISO),
    available: d.availablePct,
    rain: Math.round(d.rainMm * 10) / 10,
    irrigation: d.irrigationMm > 0 ? Math.round(d.irrigationMm) : 0,
  }));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-semibold text-af-ink">{t("irrigation.chart.title")}</h3>
        <span className="text-xs text-af-muted">
          {t("irrigation.chart.capacity", { mm: plan.taw })}
        </span>
      </div>
      <p className="text-xs text-af-ink-2 mb-4">
        {t("irrigation.chart.subtitle", {
          crop: plan.cropName ?? t("irrigation.chart.theCrop"),
        })}
      </p>

      <div className="h-[280px]">
        <LineChart
          data={data}
          xDataKey="date"
          /* No aspectRatio: the parent sets the height, which keeps the card
             the same size it was before the chart changed library. */
          style={{ height: "100%" }}
          margin={{ top: 16, right: 52, bottom: 28, left: 8 }}
        >
          <Grid
            horizontal
            stroke={GRID}
            /* The refill point. Below this row the crop starts paying for the
               shortfall, so it is the one value on the chart a farmer has to
               be able to find without reading an axis. */
            highlightRowValues={[triggerPct]}
            highlightRowStroke={SEVERITY.orange}
            highlightRowStrokeDasharray="5,4"
          />
          <YAxis yAxisId="pct" formatValue={(v) => `${Math.round(v)}%`} />
          <YAxis yAxisId="mm" orientation="right" formatValue={(v) => `${Math.round(v)}mm`} />

          <Line
            dataKey="available"
            yAxisId="pct"
            stroke={SOIL}
            strokeWidth={2.5}
            showMarkers
          />
          <Line
            dataKey="rain"
            yAxisId="mm"
            stroke={RAIN}
            strokeWidth={2}
            /* Rain is a daily total, not a continuous level — the dashes say
               "these are readings, not a trend you can interpolate". */
            dashFromIndex={0}
            dashArray="4,4"
          />

          <XAxis numTicks={7} />

          <ChartTooltip
            indicatorColor={SOIL}
            rows={(point) => {
              const rows = [
                {
                  label: t("irrigation.chart.soilWater"),
                  value: `${point.available ?? 0}%`,
                  color: SOIL,
                },
                {
                  label: t("irrigation.chart.rain"),
                  value: `${point.rain ?? 0} mm`,
                  color: RAIN,
                },
              ];
              // Only on the days the plan actually waters — an "irrigation:
              // 0 mm" row on five of seven days is noise.
              if (Number(point.irrigation) > 0) {
                rows.push({
                  label: t("irrigation.chart.irrigation"),
                  value: `${point.irrigation} mm`,
                  color: SERIES.income,
                });
              }
              return rows;
            }}
          />
        </LineChart>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-af-muted">
        <Key color={SOIL} label={t("irrigation.chart.soilWater")} />
        <Key color={RAIN} label={t("irrigation.chart.rainfall")} />
        <Key color={SEVERITY.orange} label={t("irrigation.chart.refillPoint")} />
        {/*
          The probe reports one value, now, so it was always a single dot on a
          seven-day line — and a line chart has nowhere honest to put one. It
          reads as a number beside the key instead, which is also how a farmer
          would say it out loud.
        */}
        {sensorPct != null && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: CATEGORICAL[3] }}
            />
            {t("irrigation.chart.probeToday")}: {Math.round(sensorPct)}%
          </span>
        )}
        {sensorAt && (
          <span>
            {t("irrigation.chart.probeAt", {
              time: new Date(sensorAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
        )}
      </div>
    </Card>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
