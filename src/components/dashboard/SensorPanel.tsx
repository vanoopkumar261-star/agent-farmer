"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Droplets,
  RefreshCw,
  Sprout,
  Thermometer,
  Wifi,
  WifiOff,
  X, FlaskConical,} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { AXIS, GRID, tooltipStyle } from "@/lib/chartTheme";
import { useT } from "@/components/i18n/LanguageProvider";
import type {
  MetricKey,
  SensorMetric,
  SensorSnapshot,
} from "@/app/api/sensors/route";

/** Per-metric identity — icon + a saturated hue from the app chart palette. */
const META: Record<MetricKey, { Icon: typeof Thermometer; color: string }> = {
  temperature: { Icon: Thermometer, color: "#B58A18" }, // Mustard
  humidity: { Icon: Droplets, color: "#3E6FB8" }, // Field Blue
  soilMoisture: { Icon: Sprout, color: "#3F7A2E" }, // Crop Green
  npk: { Icon: FlaskConical, color: "#7A5C2E" }, // Earth Brown
};

const ORDER: MetricKey[] = ["temperature", "humidity", "soilMoisture", "npk"];

/**
 * How long a channel may go quiet before the panel stops calling it "Live".
 *
 * The badge used to key off "is there any reading at all", so a node that had
 * been switched off for days still read Live while the tiles underneath said
 * "Updated 2d ago" — the card contradicted itself. The nodes publish minutes
 * apart at most, so half an hour of silence is comfortably past any normal gap
 * and means the node really is off or has lost its uplink.
 */
const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * How often the card re-polls on its own.
 *
 * Matched to the `revalidate: 60` on the route's ThingSpeak fetch — polling
 * faster only re-serves the same cached feed. This is what lets the badge fall
 * back to "Offline" by itself once a node goes quiet, instead of sitting on
 * whatever was true when the page was opened.
 */
const POLL_MS = 60 * 1000;

/** True when the newest reading is recent enough to call the channel live. */
function isFresh(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && Date.now() - t < STALE_AFTER_MS;
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SensorPanel() {
  const { t } = useT();
  const [snap, setSnap] = useState<SensorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);
  const [open, setOpen] = useState<MetricKey | null>(null);

  /**
   * "initial" shows skeletons, "manual" spins the refresh control, "silent" is
   * the background poll — no spinner, and a failed one keeps the last readings
   * on screen rather than blanking the card for a blip of connectivity.
   */
  const load = useCallback(async (mode: "initial" | "manual" | "silent" = "initial") => {
    if (mode === "manual") setRefreshing(true);
    else if (mode === "initial") setLoading(true);
    try {
      const res = await fetch("/api/sensors", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SensorSnapshot;
      setSnap(data);
      setErrored(false);
    } catch {
      // A silent poll that fails leaves the previous snapshot in place; only a
      // visible attempt is allowed to replace the readings with an error.
      if (mode !== "silent") setErrored(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Keep the card true on its own. Re-polling re-renders, which is what lets
   * `isFresh` re-evaluate against the clock — so a node that stops publishing
   * flips the badge to Offline without the farmer touching anything.
   *
   * Polling pauses while the tab is hidden (a dashboard left open in a
   * background tab shouldn't keep hitting the route) and catches up the moment
   * it is looked at again, so what's on screen is never stale on return.
   */
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") load("silent");
    };
    const id = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [load]);

  const timeAgo = useCallback(
    (iso: string) => {
      const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
      if (mins < 1) return t("sensorPanel.justNow");
      if (mins < 60) return t("sensorPanel.minAgo", { n: mins });
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return t("sensorPanel.hrAgo", { n: hrs });
      return t("sensorPanel.dayAgo", { n: Math.floor(hrs / 24) });
    },
    [t]
  );

  const metrics = snap?.metrics ?? [];
  const anyConfigured = snap?.configured ?? false;
  // Recomputed on every render, which is also every refresh — good enough for a
  // panel the farmer refreshes by hand; it does not need to tick on its own.
  const live = isFresh(snap?.updatedAt);
  const openMetric = open ? metrics.find((m) => m.key === open) ?? null : null;

  return (
    <Card className="p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <Activity className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-af-muted">
                {t("sensorPanel.label")}
              </span>
              {!loading && anyConfigured && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold font-mono tracking-[0.12em] uppercase ${
                    live
                      ? "bg-af-primary/10 text-af-primary-deep"
                      : "bg-af-bg text-af-muted"
                  }`}
                  title={
                    snap?.updatedAt && !live
                      ? t("sensorPanel.updated", { time: timeAgo(snap.updatedAt) })
                      : undefined
                  }
                >
                  {live ? (
                    <><Wifi className="w-2.5 h-2.5" /> {t("sensorPanel.live")}</>
                  ) : (
                    <><WifiOff className="w-2.5 h-2.5" /> {t("sensorPanel.offline")}</>
                  )}
                </span>
              )}
            </div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("sensorPanel.title")}
            </h2>
            <p className="text-meta text-af-muted">{t("sensorPanel.subtitle")}</p>
          </div>
        </div>

        <button
          onClick={() => load("manual")}
          disabled={refreshing || loading}
          title={t("sensorPanel.refresh")}
          aria-label={t("sensorPanel.refresh")}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-card border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ORDER.map((k) => (
              <Skeleton key={k} className="h-[132px] rounded-xl" />
            ))}
          </div>
        ) : errored ? (
          <p className="text-sm text-af-muted py-6 text-center">{t("sensorPanel.loadError")}</p>
        ) : !anyConfigured ? (
          <div className="rounded-xl border border-dashed border-af-border bg-af-bg px-5 py-8 text-center">
            <p className="text-sm font-semibold text-af-ink">{t("sensorPanel.notConnectedTitle")}</p>
            <p className="mt-1.5 text-meta text-af-muted max-w-md mx-auto leading-relaxed">
              {t("sensorPanel.notConnectedBody")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ORDER.map((key) => {
              const m = metrics.find((x) => x.key === key);
              return (
                <MetricTile
                  key={key}
                  metric={
                    m ?? { key, configured: false, unit: "", latest: null, readings: [] }
                  }
                  label={t(`sensorPanel.metric.${key}`)}
                  showMoreLabel={t("sensorPanel.showMore")}
                  noDataLabel={t("sensorPanel.noData")}
                  noSensorLabel={t("sensorPanel.noNpkSensor")}
                  updatedLabel={(iso: string) => t("sensorPanel.updated", { time: timeAgo(iso) })}
                  onShowMore={() => setOpen(key)}
                />
              );
            })}
          </div>
        )}
      </div>

      {openMetric && (
        <SensorDetailModal
          metric={openMetric}
          label={t(`sensorPanel.metric.${openMetric.key}`)}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}

function MetricTile({
  metric,
  label,
  showMoreLabel,
  noDataLabel,
  noSensorLabel,
  updatedLabel,
  onShowMore,
}: {
  metric: SensorMetric;
  label: string;
  showMoreLabel: string;
  noDataLabel: string;
  noSensorLabel: string;
  updatedLabel: (iso: string) => string;
  onShowMore: () => void;
}) {
  const { Icon, color } = META[metric.key];
  const has = metric.configured && metric.latest != null;
  const parts = metric.placeholder ? metric.parts ?? [] : [];

  return (
    <div className="flex flex-col rounded-xl border border-af-border bg-af-bg p-4">
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-af-muted">
          {label}
        </span>
      </div>

      {/* Three numbers do not fit the one-big-figure shape the other tiles use,
          so a metric that arrives as parts renders them side by side. */}
      {parts.length > 0 ? (
        <div className="mt-3 flex items-baseline gap-3">
          {parts.map((p) => (
            <span key={p.label} className="flex items-baseline gap-1">
              <span className="text-[11px] font-semibold text-af-muted">{p.label}</span>
              <span className="font-mono text-xl font-semibold text-af-ink leading-none">
                {p.value}
              </span>
            </span>
          ))}
          <span className="text-[11px] font-semibold text-af-muted">{metric.unit}</span>
        </div>
      ) : (
        <div className="mt-3 flex items-baseline gap-1">
          {has ? (
            <>
              <span className="font-mono text-3xl font-semibold text-af-ink leading-none">
                {metric.latest!.value}
              </span>
              <span className="text-sm font-semibold text-af-muted">{metric.unit}</span>
            </>
          ) : (
            <span className="text-sm text-af-muted">{noDataLabel}</span>
          )}
        </div>
      )}

      {/* Where the number came from. A value with no sensor behind it has to say
          so on the tile itself — the same rule the market board follows with its
          "Demo prices" pill. */}
      <div className="mt-1 text-[11px] text-af-muted min-h-[15px]">
        {metric.placeholder ? noSensorLabel : has ? updatedLabel(metric.latest!.at) : ""}
      </div>

      <button
        onClick={onShowMore}
        disabled={metric.readings.length === 0}
        className="mt-3 inline-flex items-center justify-center rounded-[10px] border border-af-border bg-af-card px-3 py-1.5 text-meta font-semibold text-af-ink-2 transition hover:border-af-primary/40 hover:text-af-ink disabled:opacity-40 disabled:pointer-events-none"
      >
        {showMoreLabel}
      </button>
    </div>
  );
}

function SensorDetailModal({
  metric,
  label,
  onClose,
}: {
  metric: SensorMetric;
  label: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const { Icon, color } = META[metric.key];
  const gradId = `sensor-grad-${metric.key}`;

  // Chart wants oldest → newest; `readings` is newest first.
  const chartData = [...metric.readings]
    .reverse()
    .map((r) => ({ label: fmtClock(r.at), value: r.value, full: fmtFull(r.at) }));

  const last20 = metric.readings.slice(0, 20);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-af-ink/50" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-af-border bg-af-card shadow-af-float">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-af-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}1A`, color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-sans text-lg font-semibold text-af-ink">{label}</h2>
              {metric.latest && (
                <p className="font-mono text-[11px] font-semibold text-af-muted">
                  {metric.latest.value}
                  {metric.unit} · {fmtFull(metric.latest.at)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("sensorPanel.close")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-af-border bg-af-bg text-af-muted transition hover:border-af-primary/40 hover:text-af-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* Graph */}
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
            {t("sensorPanel.history")}
          </div>
          <div className="mt-3 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  unit={metric.unit}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: GRID }}
                  labelFormatter={(_l, p) => (p && p[0] ? (p[0].payload as any).full : "")}
                  formatter={(v: number) => [`${v}${metric.unit}`, label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Last 20 readings */}
          <div className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
            {t("sensorPanel.recentReadings", { n: last20.length })}
          </div>
          <div className="mt-3 overflow-hidden rounded-[14px] border border-af-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-af-bg text-left text-[11px] font-semibold uppercase tracking-wide text-af-muted">
                  <th className="px-4 py-2.5">{t("sensorPanel.colTime")}</th>
                  <th className="px-4 py-2.5 text-right">{t("sensorPanel.colReading")}</th>
                </tr>
              </thead>
              <tbody>
                {last20.map((r, i) => (
                  <tr key={r.at + i} className="border-t border-af-border">
                    <td className="px-4 py-2.5 text-af-ink-2">{fmtFull(r.at)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-af-ink">
                      {r.value}
                      {metric.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
