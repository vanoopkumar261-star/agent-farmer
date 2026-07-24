"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import Badge from "@/components/ui/Badge";
import TrendDelta from "@/components/ui/TrendDelta";
import { BarChart3 } from "lucide-react";

const EMERALD = "#10B981";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const GRID = "#E4E9E3";
const AXIS = "#8A8A8A";

// Realistic demo series (no historical data captured yet).
const yieldData = [
  { w: "W1", v: 8 },
  { w: "W3", v: 15 },
  { w: "W5", v: 26 },
  { w: "W7", v: 41 },
  { w: "W9", v: 58 },
  { w: "W11", v: 72 },
  { w: "W13", v: 84 },
];

const DEMO_CASH = [
  { m: "May", income: 0, expense: 12000 },
  { m: "Jun", income: 22000, expense: 17500 },
  { m: "Jul", income: 23000, expense: 4600 },
];

export type CashPoint = { m: string; income: number; expense: number };

const marketData = [
  { d: "Mon", price: 2180 },
  { d: "Tue", price: 2210 },
  { d: "Wed", price: 2165 },
  { d: "Thu", price: 2240 },
  { d: "Fri", price: 2290 },
  { d: "Sat", price: 2320 },
  { d: "Sun", price: 2360 },
];

const tabs = [
  { id: "yield", label: "Yield" },
  { id: "cash", label: "Cash Flow" },
  { id: "market", label: "Market" },
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #E4E9E3",
  boxShadow: "0 12px 32px rgba(16,24,20,0.08)",
  fontSize: 12,
  padding: "8px 12px",
};

export default function AnalyticsCard({
  cash,
  netProfit,
}: {
  cash?: CashPoint[];
  netProfit?: number;
}) {
  const [tab, setTab] = useState("yield");
  const cashData = cash && cash.length > 0 ? cash : DEMO_CASH;
  const usingReal = Boolean(cash && cash.length > 0);
  const net = usingReal && netProfit !== undefined ? netProfit : 44000;
  const netLabel = `₹${Math.round(net / 1000)}k`;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-af-ink leading-tight">Farm Analytics</h2>
            <p className="text-[13px] text-af-muted">Season performance overview</p>
          </div>
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Headline metric per tab */}
      <div className="flex items-center gap-3 mb-4">
        {tab === "yield" && (
          <>
            <span className="font-mono text-2xl font-extrabold text-af-ink">84%</span>
            <Badge tone="primary">of target</Badge>
            <TrendDelta value={12} />
          </>
        )}
        {tab === "cash" && (
          <>
            <span className="font-mono text-2xl font-extrabold text-af-ink">{netLabel}</span>
            <Badge tone={net >= 0 ? "primary" : "danger"}>{net >= 0 ? "net positive" : "net loss"}</Badge>
            {usingReal ? null : <TrendDelta value={18} />}
          </>
        )}
        {tab === "market" && (
          <>
            <span className="font-mono text-2xl font-extrabold text-af-ink">₹2,360</span>
            <Badge tone="ai">per quintal</Badge>
            <TrendDelta value={8} />
          </>
        )}
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {tab === "yield" ? (
            <AreaChart data={yieldData} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="w" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID }} />
              <Area
                type="monotone"
                dataKey="v"
                name="Growth"
                stroke={EMERALD}
                strokeWidth={2}
                fill="url(#yieldFill)"
              />
            </AreaChart>
          ) : tab === "cash" ? (
            <BarChart data={cashData} margin={{ top: 6, right: 8, bottom: 0, left: -8 }} barGap={4}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(v: number) => `₹${Number(v).toLocaleString("en-IN")}`} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar dataKey="income" name="Income" fill={EMERALD} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={marketData} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: AXIS, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 40", "dataMax + 40"]}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID }} />
              <Line
                type="monotone"
                dataKey="price"
                name="Paddy ₹/qtl"
                stroke={BLUE}
                strokeWidth={2}
                dot={{ r: 3, fill: BLUE }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
