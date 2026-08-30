"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import Badge from "@/components/ui/Badge";
import { BarChart3 } from "lucide-react";
import { SERIES, STATUS, GRID, AXIS, tooltipStyle } from "@/lib/chartTheme";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * Farm Analytics — every series here is derived from the farmer's own records.
 *
 * It previously shipped two hardcoded arrays: a `yieldData` growth curve and a
 * `marketData` week of prices, both literals sitting under a "realistic demo
 * series" comment. They looked like insight and carried none, which is worse
 * than an empty state. They are gone.
 *
 * What replaced them had to clear one bar — the data must exist, and it must
 * change on its own:
 *   · Season   — real progress through each farm's seeding → harvest window.
 *   · Weather  — the real 7-day forecast, drawn against this crop's own heat
 *                threshold, so the line means something specific to this farm.
 *   · Cash     — real income and expense from farm_expenses.
 *
 * A price-history tab is deliberately absent. The Agmarknet feed exposes only
 * today's cross-mandi prices with no history, so any trend line would have been
 * invented; today's real spread already lives on the Market page.
 */

export type CashPoint = { m: string; income: number; expense: number };

/** One day of the real forecast, trimmed to what the chart needs. */
export type WeatherPoint = { day: string; tMax: number; tMin: number; rain: number };

/** One farm's real position in its cycle. */
export type SeasonPoint = {
  name: string;
  progress: number; // 0..100 through the cycle
  stage: string;
  daysLeft: number;
};

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const inkLegend = (value: string) => <span style={{ color: "#3F5347" }}>{value}</span>;

export default function AnalyticsCard({
  cash,
  netProfit,
  weather = [],
  season = [],
  /** The lowest heat tolerance among this farmer's crops. */
  heatThreshold,
}: {
  cash?: CashPoint[];
  netProfit?: number;
  weather?: WeatherPoint[];
  season?: SeasonPoint[];
  heatThreshold?: number;
}) {
  const { t } = useT();
  const hasCash = Boolean(cash && cash.length > 0);
  const hasWeather = weather.length > 0;
  const hasSeason = season.length > 0;

  // Open on a tab that actually has something in it, not a blank frame.
  const [tab, setTab] = useState(hasSeason ? "season" : hasWeather ? "weather" : "cash");

  const tabs = [
    { id: "season", label: t("analyticsCard.tabSeason") },
    { id: "weather", label: t("analyticsCard.tabWeather") },
    { id: "cash", label: t("analyticsCard.tabCash") },
  ];

  const net = netProfit ?? 0;
  const netLabel = `₹${Math.round(net / 1000)}k`;
  const soonest = hasSeason ? season.reduce((a, b) => (a.daysLeft <= b.daysLeft ? a : b)) : null;
  const hottest = hasWeather ? Math.max(...weather.map((d) => d.tMax)) : 0;
  const wettest = hasWeather ? Math.max(...weather.map((d) => d.rain)) : 0;
  const overHeat = Boolean(heatThreshold && hottest >= heatThreshold);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("analyticsCard.title")}
            </h2>
            <p className="text-meta text-af-muted">{t("analyticsCard.subtitle")}</p>
          </div>
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Headline figure — says what the chart below is actually about. */}
      <div className="flex flex-wrap items-center gap-3 mb-4 min-h-[34px]">
        {tab === "season" && soonest && (
          <>
            <span className="font-mono text-2xl font-semibold tracking-[-0.02em] text-af-ink">
              {soonest.daysLeft}d
            </span>
            <Badge tone="primary">{t("analyticsCard.toFirstHarvest")}</Badge>
            <span className="text-meta text-af-muted">
              {soonest.name} · {soonest.stage}
            </span>
          </>
        )}
        {tab === "weather" && hasWeather && (
          <>
            <span className="font-mono text-2xl font-semibold tracking-[-0.02em] text-af-ink">
              {hottest}°C
            </span>
            <Badge tone={overHeat ? "danger" : "primary"}>
              {overHeat ? t("analyticsCard.aboveCropLimit") : t("analyticsCard.withinRange")}
            </Badge>
            <span className="text-meta text-af-muted">{t("analyticsCard.sevenDayPeak", { pct: wettest })}</span>
          </>
        )}
        {tab === "cash" && (
          <>
            <span className="font-mono text-2xl font-semibold tracking-[-0.02em] text-af-ink">
              {netLabel}
            </span>
            <Badge tone={net >= 0 ? "primary" : "danger"}>
              {net >= 0 ? t("analyticsCard.netPositive") : t("analyticsCard.netLoss")}
            </Badge>
            <span className="text-meta text-af-muted">{t("analyticsCard.seasonToDate")}</span>
          </>
        )}
      </div>

      <div className="h-[240px] w-full">
        {tab === "season" ? (
          hasSeason ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={season}
                layout="vertical"
                margin={{ top: 6, right: 20, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={86}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  formatter={(v: number, _n: string, p: any) => [
                    `${v}% grown · ${p.payload.stage} · ${p.payload.daysLeft}d to harvest`,
                    "Progress",
                  ]}
                />
                <Bar dataKey="progress" name="Progress" radius={[0, 4, 4, 0]} barSize={22}>
                  {season.map((s, i) => (
                    <Cell key={i} fill={SERIES.yield} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty text={t("analyticsCard.emptySeason")} />
          )
        ) : tab === "weather" ? (
          hasWeather ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weather} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: GRID }}
                  formatter={(v: number, name: string) => [
                    name === "Rain chance" ? `${v}%` : `${v}°C`,
                    name,
                  ]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={inkLegend} />
                {/* The crop's own tolerance — what makes this chart theirs. */}
                {heatThreshold ? (
                  <ReferenceLine
                    y={heatThreshold}
                    stroke={STATUS.down}
                    strokeDasharray="4 4"
                    label={{
                      value: `heat limit ${heatThreshold}°`,
                      position: "insideTopRight",
                      fill: STATUS.down,
                      fontSize: 10,
                    }}
                  />
                ) : null}
                <Bar
                  dataKey="rain"
                  name="Rain chance"
                  fill={SERIES.market}
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                  opacity={0.4}
                />
                <Line type="monotone" dataKey="tMax" name="High" stroke={SERIES.expense} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="tMin" name="Low" stroke={SERIES.yield} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Empty text={t("analyticsCard.emptyWeather")} />
          )
        ) : hasCash ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cash} margin={{ top: 6, right: 8, bottom: 0, left: -8 }} barGap={4}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: AXIS, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                formatter={(v: number) => rupee(v)}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={inkLegend} />
              <Bar dataKey="income" name="Income" fill={SERIES.income} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={SERIES.expense} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty text={t("analyticsCard.emptyCash")} />
        )}
      </div>
    </Card>
  );
}

/** Honest blank state — better than a chart of numbers nobody entered. */
function Empty({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-sm text-af-muted max-w-xs">{text}</p>
    </div>
  );
}
