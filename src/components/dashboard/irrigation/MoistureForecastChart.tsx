"use client";

/**
 * Seven days of soil water, forecast forward.
 *
 * The series is *available water* as a percentage of what the root zone can
 * hold, not depletion in millimetres — a farmer reads "the field is at 40%"
 * far faster than "depletion is 52 mm", and the refill point becomes a line to
 * stay above rather than one to stay below.
 *
 * Rain is drawn as bars behind the curve so the two read together: the eye
 * should land on a rainy day and see the curve climb without the farmer
 * pumping anything. That relationship is the whole argument for the feature.
 */

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import Card from "@/components/ui/Card";
import { AXIS, GRID, SERIES, CATEGORICAL, SEVERITY, tooltipStyle } from "@/lib/chartTheme";
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
  const { t } = useT();

  if (!plan.forecast.length) return null;

  // The trigger line, expressed on the same axis as the curve. For drip this
  // sits well above RAW because the system tops up little and often.
  const triggerPct = Math.round(((plan.taw - plan.triggerMm) / Math.max(1, plan.taw)) * 100);

  const data = plan.forecast.map((d, i) => ({
    day: i === 0 ? t("weatherCard.today") : d.weekday,
    available: d.availablePct,
    rain: Math.round(d.rainMm * 10) / 10,
    irrigation: d.irrigationMm > 0 ? Math.round(d.irrigationMm) : null,
    // The probe reports one value now, so it is only meaningful against today.
    probe: i === 0 && sensorPct != null ? Math.round(sensorPct) : null,
  }));

  const maxRain = Math.max(10, ...data.map((d) => d.rain));

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

      <div className="h-[260px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="soilWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.market} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES.market} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" stroke={AXIS} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              yAxisId="pct"
              domain={[0, 100]}
              stroke={AXIS}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              unit="%"
              width={44}
            />
            <YAxis yAxisId="mm" orientation="right" domain={[0, maxRain]} hide />

            <Tooltip
              contentStyle={tooltipStyle}
              /*
                The unit is chosen from the series' `dataKey`, not its display
                name. Matching on the name worked only while the names were
                English literals: translate them and every series silently
                falls through to the millimetre branch, so soil water would
                have read "42 mm" instead of "42%".
              */
              formatter={(value: any, name: string, item: any) => {
                if (value == null) return ["—", name];
                const key = item?.dataKey;
                const isPercent = key === "available" || key === "probe";
                return [isPercent ? `${value}%` : `${value} mm`, name];
              }}
            />

            <Bar
              yAxisId="mm"
              dataKey="rain"
              name={t("irrigation.chart.rain")}
              fill={CATEGORICAL[2]}
              fillOpacity={0.22}
              radius={[4, 4, 0, 0]}
              barSize={26}
            />
            <Bar
              yAxisId="mm"
              dataKey="irrigation"
              name={t("irrigation.chart.irrigation")}
              fill={SERIES.income}
              fillOpacity={0.55}
              radius={[4, 4, 0, 0]}
              barSize={14}
            />

            <ReferenceLine
              yAxisId="pct"
              y={triggerPct}
              stroke={SEVERITY.orange}
              strokeDasharray="5 4"
              label={{
                value: t("irrigation.chart.refillPoint"),
                position: "insideTopRight",
                fontSize: 10,
                fill: SEVERITY.orange,
              }}
            />

            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="available"
              name={t("irrigation.chart.soilWater")}
              stroke={SERIES.market}
              strokeWidth={2}
              fill="url(#soilWater)"
            />

            {sensorPct != null && (
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="probe"
                name={t("irrigation.chart.probe")}
                stroke={CATEGORICAL[3]}
                strokeWidth={0}
                dot={{ r: 5, fill: CATEGORICAL[3] }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-af-muted">
        <Key color={SERIES.market} label={t("irrigation.chart.soilWater")} />
        <Key color={CATEGORICAL[2]} label={t("irrigation.chart.rainfall")} />
        <Key color={SERIES.income} label={t("irrigation.chart.plannedIrrigation")} />
        {sensorPct != null && (
          <Key color={CATEGORICAL[3]} label={t("irrigation.chart.probeToday")} />
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
