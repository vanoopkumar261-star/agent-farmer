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
import { TrendingUp, TrendingDown, MapPin, Store } from "lucide-react";
import type { CropMarket, MandiRow } from "@/lib/market";

const GRID = "#E4E9E3";
const AXIS = "#8A8A8A";
const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

const demandTone = { High: "primary", Medium: "amber", Low: "danger" } as const;

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
  const active = crops.find((c) => c.name === selected) ?? crops[0];
  const mandis = mandisByFocus[active.name] ?? [];
  const up = active.change >= 0;
  const chartColor = up ? "#10B981" : "#D93025";

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
                  : "border-af-border bg-af-card shadow-af-sm hover:-translate-y-0.5 hover:shadow-af-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-af-ink">{c.name}</span>
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                    cUp ? "text-af-primary-deep" : "text-af-danger"
                  }`}
                >
                  {cUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {cUp ? "+" : ""}
                  {c.change}%
                </span>
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-af-ink">{rupee(c.price)}</div>
              <div className="text-[10px] text-af-muted">{c.unit}</div>
              <div className="mt-2 -mx-1">
                <Sparkline data={c.series.map((s) => s.price)} color={cUp ? "#10B981" : "#D93025"} height={26} />
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
                <h2 className="text-lg font-extrabold text-af-ink">{active.name}</h2>
                <Badge tone={demandTone[active.demand]}>{active.demand} demand</Badge>
              </div>
              <p className="text-[13px] text-af-muted">21-day price trend · {active.unit}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-extrabold text-af-ink">{rupee(active.price)}</div>
              <div className={`text-[12px] font-bold ${up ? "text-af-primary-deep" : "text-af-danger"}`}>
                {up ? "▲" : "▼"} {up ? "+" : ""}
                {active.change}% today
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
                <XAxis dataKey="d" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
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
          <div className="flex items-center gap-2.5 mb-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
              <Store className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-af-ink leading-tight">Nearby Mandis</h2>
              <p className="text-[13px] text-af-muted">{active.name} · best rates first</p>
            </div>
          </div>
          <ul className="divide-y divide-af-border">
            {mandis.map((m, i) => (
              <li key={m.mandi} className="flex items-center gap-3 py-2.5">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold shrink-0 ${
                    i === 0 ? "bg-af-primary/10 text-af-primary-deep" : "bg-af-bg text-af-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-af-ink truncate">{m.mandi}</div>
                  <div className="inline-flex items-center gap-1 text-[11px] text-af-muted">
                    <MapPin className="w-3 h-3" /> {m.distanceKm} km away
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-af-ink">{rupee(m.price)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
