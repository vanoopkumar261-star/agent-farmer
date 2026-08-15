"use client";

import { useState } from "react";
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
import Badge from "@/components/ui/Badge";
import Sparkline from "./Sparkline";
import { TrendingUp, TrendingDown, MapPin, Store, ChevronDown } from "lucide-react";
import type { CropMarket, MandiRow } from "@/lib/market";
import type { CostTier } from "@/lib/mandi-costs";
import { STATUS, GRID, AXIS } from "@/lib/chartTheme";

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

const demandTone = { High: "primary", Medium: "amber", Low: "danger" } as const;

/**
 * Where each number in the breakdown comes from. Rendered as a coloured dot so a
 * government figure and a modelled guess are never mistaken for one another.
 */
const TIER_META: Record<CostTier, { dot: string; label: string }> = {
  exact: { dot: "bg-af-primary", label: "From the government feed" },
  statutory: { dot: "bg-af-ai", label: "State APMC rules — indicative" },
  estimated: { dot: "bg-af-amber", label: "Estimated — editable in Settings" },
};

export default function MarketBoard({
  crops,
  mandisByFocus,
  focusName,
}: {
  crops: CropMarket[];
  mandisByFocus: Record<string, MandiRow[]>;
  focusName: string;
}) {
  const [selected, setSelected] = useState(focusName);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"gross" | "net">("gross");
  const active = crops.find((c) => c.name === selected) ?? crops[0];

  const mandis = [...(mandisByFocus[active.name] ?? [])].sort((a, b) =>
    sortBy === "net"
      ? (b.breakdown?.net ?? b.price) - (a.breakdown?.net ?? a.price)
      : b.price - a.price
  );
  const up = active.change >= 0;
  const chartColor = up ? STATUS.up : STATUS.down;
  const isLive = active.source === "live";

  return (
    <div className="space-y-6">
      {/* Price cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {crops.map((c) => {
          const isActive = c.name === active.name;
          const cUp = c.change >= 0;
          return (
            <button
              key={c.name}
              onClick={() => setSelected(c.name)}
              className={`af-spotlight relative overflow-hidden text-left rounded-2xl border p-4 transition-all ${
                isActive
                  ? "border-af-primary/50 bg-af-card ring-2 ring-af-primary/15 shadow-af-md"
                  : "border-af-border bg-af-card shadow-af-sm hover:shadow-af-md hover:border-af-primary/25"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-af-ink">{c.name}</span>
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                    cUp ? "text-af-primary-deep" : "text-af-danger"
                  }`}
                >
                  {cUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {cUp ? "+" : ""}
                  {c.change}%
                </span>
              </div>
              <div className="mt-1 font-mono text-[17px] font-semibold tracking-[-0.02em] text-af-ink">{rupee(c.price)}</div>
              <div className="text-[10px] text-af-muted">{c.unit}</div>
              <div className="mt-2 -mx-1">
                <Sparkline data={c.series.map((s) => s.price)} color={cUp ? STATUS.up : STATUS.down} height={26} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Trend + mandi table */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">{active.name}</h2>
                <Badge tone={demandTone[active.demand]}>{active.demand} demand</Badge>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isLive
                      ? "bg-af-primary/10 text-af-primary-deep"
                      : "bg-af-neutral/10 text-af-muted"
                  }`}
                  title={
                    isLive
                      ? "Live Agmarknet mandi prices"
                      : "Estimated — live data unavailable for this crop/region"
                  }
                >
                  {isLive ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-af-primary animate-pulse" /> Live
                    </>
                  ) : (
                    "Estimated"
                  )}
                </span>
              </div>
              <p className="text-meta text-af-muted">
                {isLive
                  ? `Prices across nearby mandis${active.asOf ? ` · as of ${active.asOf}` : ""} · ${active.unit}`
                  : `21-day price trend (estimated) · ${active.unit}`}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold text-af-ink">{rupee(active.price)}</div>
              <div className={`text-[12px] font-semibold ${up ? "text-af-primary-deep" : "text-af-danger"}`}>
                {up ? "▲" : "▼"} {up ? "+" : ""}
                {active.change}% {isLive ? "vs median" : "today"}
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={active.series} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="mktFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={isLive ? 0 : 4} />
                <YAxis
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 60", "dataMax + 60"]}
                  tickFormatter={(v) => `₹${v}`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E4E9E3", fontSize: 12 }}
                  formatter={(v: number) => rupee(v)}
                />
                <Area type="monotone" dataKey="price" name={active.name} stroke={chartColor} strokeWidth={2} fill="url(#mktFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Nearby mandis */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
                <Store className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">Nearby Mandis</h2>
                <p className="text-meta text-af-muted">{active.name} · tap a mandi for the breakdown</p>
              </div>
            </div>
            {/* The whole point: the top gross mandi often isn't the top net one. */}
            <div className="flex rounded-[10px] border border-af-border bg-af-bg p-0.5 shrink-0">
              {(["gross", "net"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition ${
                    sortBy === k ? "bg-af-card text-af-ink shadow-af-sm" : "text-af-muted hover:text-af-ink-2"
                  }`}
                >
                  {k === "gross" ? "Quoted" : "Net to you"}
                </button>
              ))}
            </div>
          </div>

          {!isLive && (
            <p className="mb-3 rounded-[10px] border border-af-amber/25 bg-af-amber/[0.07] px-3 py-2 text-[11px] text-af-ink-2">
              These mandis and prices are <strong>estimated</strong> — live data isn&apos;t available for{" "}
              {active.name} in your region, so no transport cost is applied.
            </p>
          )}

          <ul className="divide-y divide-af-border">
            {mandis.map((m, i) => {
              const b = m.breakdown;
              const isOpen = expanded === m.mandi;
              return (
                <li key={m.mandi} className="py-1">
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.mandi)}
                    className="w-full flex items-center gap-3 py-2 text-left rounded-[10px] hover:bg-af-bg transition px-1"
                  >
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-semibold shrink-0 ${
                        i === 0 ? "bg-af-primary/10 text-af-primary-deep" : "bg-af-bg text-af-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-af-ink truncate">{m.mandi}</div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-af-muted">
                        <MapPin className="w-3 h-3" />
                        {m.distanceKm != null ? `${m.distanceKm} km away` : m.place || "Nearby"}
                        {m.grade ? ` · ${m.grade}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-semibold text-af-ink">{rupee(m.price)}</div>
                      {b && (
                        <div className="font-mono text-[10px] text-af-muted">net {rupee(b.net)}</div>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-af-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && b && <Breakdown row={m} />}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-af-border pt-3">
            {(Object.keys(TIER_META) as CostTier[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-[10px] text-af-muted">
                <span className={`w-1.5 h-1.5 rounded-full ${TIER_META[t].dot}`} />
                {TIER_META[t].label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * The expanded price breakdown for one mandi: what it's quoting, how that sits
 * against the government floor and today's state median, and what comes off
 * before the money reaches the farmer.
 */
function Breakdown({ row }: { row: MandiRow }) {
  const b = row.breakdown!;

  return (
    <div className="mb-2 ml-1 mr-1 rounded-[12px] border border-af-border bg-af-bg/60 p-3.5">
      {/* Benchmarks — the "standard market price" anchors */}
      {b.benchmarks.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {b.benchmarks.map((bm) => {
            const over = bm.deltaPct >= 0;
            return (
              <div key={bm.label} className="rounded-[10px] border border-af-border bg-af-card px-2.5 py-2">
                <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-af-muted truncate">
                  {bm.label}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-meta font-semibold text-af-ink">{rupee(bm.value)}</span>
                  <span
                    className={`text-[10px] font-semibold ${over ? "text-af-primary-deep" : "text-af-danger"}`}
                  >
                    {over ? "+" : ""}
                    {bm.deltaPct}%
                  </span>
                </div>
                <div className="mt-0.5 text-[9.5px] leading-tight text-af-muted">{bm.note}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quoted price → deductions → net */}
      <div className="flex items-center justify-between py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-af-ink">
          <span className={`w-1.5 h-1.5 rounded-full ${TIER_META.exact.dot}`} />
          Quoted modal price
        </span>
        <span className="font-mono text-meta font-semibold text-af-ink">{rupee(b.gross)}</span>
      </div>

      {row.min != null && row.max != null && row.max > row.min && (
        <div className="pb-1.5 pl-3 text-[10px] text-af-muted">
          Yard range {rupee(row.min)} – {rupee(row.max)}
          {row.variety ? ` · ${row.variety}` : ""}
        </div>
      )}

      <ul className="divide-y divide-af-border/70 border-t border-af-border/70">
        {b.lines.map((l) => (
          <li key={l.label} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-af-ink-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIER_META[l.tier].dot}`} />
                {l.label}
              </div>
              <div className="pl-3 text-[9.5px] leading-tight text-af-muted">{l.note}</div>
            </div>
            <span className="font-mono text-[12px] font-semibold text-af-danger shrink-0">
              −{rupee(Math.abs(l.amount))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between rounded-[10px] bg-af-primary/[0.07] px-2.5 py-2">
        <div>
          <div className="text-[12px] font-semibold text-af-primary-deep">Net at your farm gate</div>
          <div className="text-[9.5px] text-af-muted">
            {b.deductionPct}% of the quoted price goes to charges &amp; logistics
          </div>
        </div>
        <span className="font-mono text-[15px] font-semibold text-af-primary-deep">{rupee(b.net)}</span>
      </div>

      {b.distanceSource === "geocoded" && (
        <p className="mt-2 text-[9.5px] leading-tight text-af-muted">
          Distance is straight-line to the mandi town (±2–5 km) — road distance will be longer, so treat
          the transport figure as a floor.
        </p>
      )}
      {b.distanceSource === "district" && (
        <p className="mt-2 text-[9.5px] leading-tight text-af-muted">
          Distance is approximated from the district centre (±20–30 km) — the mandi itself wasn&apos;t found
          on the map, so the transport figure is rough.
        </p>
      )}
      {b.distanceSource === "unknown" && (
        <p className="mt-2 text-[9.5px] leading-tight text-af-muted">
          No transport cost included — this mandi&apos;s location couldn&apos;t be resolved.
        </p>
      )}
    </div>
  );
}
