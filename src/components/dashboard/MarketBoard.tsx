"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Sparkline from "./Sparkline";
import TransportPlanner from "./TransportPlanner";
import {
  TrendingUp, TrendingDown, MapPin, Store,
  RefreshCw, PackageX, AlertTriangle,
  ChevronDown, ChevronUp, Truck, Crown,
} from "lucide-react";
import type { CropMarket, MandiRow } from "@/lib/market";

const GRID = "#E4E9E3";
const AXIS = "#8A8A8A";
const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const demandTone = { High: "primary", Medium: "amber", Low: "danger" } as const;

// APMC fee percentages (must match market.ts)
const FEES = {
  marketFeePercent: 1.6,
  cessPercent: 2.0,
  commissionPercent: 2.0,
};

// ── Mandi row with expandable dropdown ───────────────────────────────────────
function MandiItem({
  mandi,
  index,
  isBest,
  cropName,
}: {
  mandi: MandiRow;
  index: number;
  isBest: boolean;
  cropName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTransport, setShowTransport] = useState(false);

  return (
    <>
      {/* Transport Modal */}
      {showTransport && (
        <TransportPlanner
          mandi={mandi}
          cropName={cropName}
          onClose={() => setShowTransport(false)}
        />
      )}

      <li
        className={`rounded-[16px] border transition-all overflow-hidden ${
          isBest
            ? "border-af-primary/40 bg-af-primary/[0.03]"
            : "border-af-border bg-af-bg"
        }`}
      >
        {/* Main row - clickable to expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        >
          {/* Rank badge */}
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold shrink-0 ${
              isBest
                ? "bg-af-primary text-white"
                : "bg-af-card text-af-muted border border-af-border"
            }`}
          >
            {isBest ? <Crown className="w-3.5 h-3.5" /> : index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-af-ink truncate">
                {mandi.mandi}
              </div>
              {isBest && (
                <span className="shrink-0 inline-flex items-center rounded-full bg-af-primary/10 text-af-primary-deep px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wide">
                  Best
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="inline-flex items-center gap-1 text-[11px] text-af-muted">
                <MapPin className="w-3 h-3" />
                {mandi.distanceKm} km
              </div>
              <div className="text-[11px] text-af-muted">
                Net: <span className="font-bold text-af-primary">{rupee(mandi.netPrice)}</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono text-sm font-bold text-af-ink">
              {rupee(mandi.price)}
            </div>
            <div className="text-[10px] text-af-muted">quoted</div>
          </div>

          <span className="text-af-muted ml-1 shrink-0">
            {expanded
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />
            }
          </span>
        </button>

        {/* Expanded dropdown */}
        {expanded && (
          <div className="border-t border-af-border px-3 pb-3 pt-3 space-y-2">

            {/* Price summary */}
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div className="rounded-[12px] bg-af-card border border-af-border px-3 py-2">
                <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-af-muted">
                  Quoted Price
                </div>
                <div className="mt-1 font-mono text-base font-extrabold text-af-ink">
                  {rupee(mandi.price)}
                  <span className="text-[10px] font-normal text-af-muted"> /qtl</span>
                </div>
              </div>
              <div className="rounded-[12px] bg-af-primary/8 border border-af-primary/20 px-3 py-2">
                <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-af-primary-deep">
                  Net to You
                </div>
                <div className="mt-1 font-mono text-base font-extrabold text-af-primary">
                  {rupee(mandi.netPrice)}
                  <span className="text-[10px] font-normal text-af-muted"> /qtl</span>
                </div>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-[12px] bg-af-card border border-af-border overflow-hidden">
              <div className="px-3 py-2 border-b border-af-border">
                <span className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-af-muted">
                  APMC Fee Breakdown
                </span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <FeeRow
                  label={`Quoted Commodity Price`}
                  value={rupee(mandi.price)}
                  bold
                />
                <FeeRow
                  label={`Market Entry Fee (APMC @ ${FEES.marketFeePercent}%)`}
                  value={`-₹${mandi.fees.marketFee.toFixed(2)}`}
                  deduction
                />
                <FeeRow
                  label={`Development Cess (@ ${FEES.cessPercent}%)`}
                  value={`-₹${mandi.fees.cess.toFixed(2)}`}
                  deduction
                />
                <FeeRow
                  label={`Commission Agent (Arhatiya @ ${FEES.commissionPercent}%)`}
                  value={`-₹${mandi.fees.commission.toFixed(2)}`}
                  deduction
                />
                <FeeRow
                  label="Loading & Unloading (Hamali)"
                  value={`-₹${mandi.fees.loading.toFixed(2)}`}
                  deduction
                />
                <FeeRow
                  label="Gunny Bags (Bardana)"
                  value={`-₹${mandi.fees.gunnyBag.toFixed(2)}`}
                  deduction
                />
                <FeeRow
                  label="Weighing Charges (Tolai)"
                  value={`-₹${mandi.fees.weighing.toFixed(2)}`}
                  deduction
                />
                <div className="h-px bg-af-border my-1" />
                <FeeRow
                  label="Net Price (After all APMC deductions)"
                  value={rupee(mandi.netPrice)}
                  highlight
                />
              </div>
            </div>

            {/* Select & Plan Transport button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTransport(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] shadow-af-sm"
            >
              <Truck className="w-4 h-4" />
              Select &amp; Plan Transport
            </button>
          </div>
        )}
      </li>
    </>
  );
}

function FeeRow({
  label,
  value,
  deduction,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  deduction?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-[11px] ${
          highlight
            ? "font-bold text-af-primary"
            : bold
            ? "font-semibold text-af-ink"
            : "text-af-muted"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-[11px] font-bold font-mono ${
          highlight
            ? "text-af-primary"
            : deduction
            ? "text-af-danger"
            : "text-af-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main MarketBoard ──────────────────────────────────────────────────────────
export default function MarketBoard({
  crops,
  mandisByFocus,
  focusName,
  state,
  isRealData,
}: {
  crops: CropMarket[];
  mandisByFocus: Record<string, MandiRow[]>;
  focusName: string;
  state?: string | null;
  isRealData?: boolean;
}) {
  const firstAvailable =
    crops.find((c) => !c.notAvailable)?.name ?? crops[0].name;

  const [selected, setSelected] = useState(
    crops.find((c) => c.name === focusName && !c.notAvailable)
      ? focusName
      : firstAvailable
  );

  const active = crops.find((c) => c.name === selected) ?? crops[0];
  const mandis = mandisByFocus[active.name] ?? [];
  const up = active.change >= 0;
  const chartColor = up ? "#10B981" : "#D93025";

  const availableCrops = crops.filter((c) => !c.notAvailable);
  const unavailableCrops = crops.filter((c) => c.notAvailable);

  return (
    <div className="space-y-6">

      {/* ── Available price cards ── */}
      {availableCrops.length > 0 && (
        <div>
          {isRealData && (
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-af-border" />
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-primary-deep">
                Live Mandi Prices · {state}
              </span>
              <div className="h-px flex-1 bg-af-border" />
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {availableCrops.map((c) => {
              const isActive = c.name === active.name;
              const cUp = c.change >= 0;
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(c.name)}
                  className={`relative overflow-hidden text-left rounded-2xl border p-4 transition-all ${
                    isActive
                      ? "border-af-primary/50 bg-af-card ring-2 ring-af-primary/15 shadow-af-md"
                      : "border-af-border bg-af-card shadow-af-sm hover:-translate-y-0.5 hover:shadow-af-md"
                  }`}
                >
                  {c.isReal && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-af-primary animate-pulse" />
                  )}
                  <div className="flex items-center justify-between pr-3">
                    <span className="text-sm font-bold text-af-ink">{c.name}</span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                        cUp ? "text-af-primary-deep" : "text-af-danger"
                      }`}
                    >
                      {cUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {cUp ? "+" : ""}{c.change}%
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-lg font-extrabold text-af-ink">
                    {rupee(c.price)}
                  </div>
                  <div className="text-[10px] text-af-muted">{c.unit}</div>
                  <div className="mt-2 -mx-1">
                    <Sparkline
                      data={c.series.map((s) => s.price)}
                      color={cUp ? "#10B981" : "#D93025"}
                      height={26}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Not arriving section ── */}
      {isRealData && unavailableCrops.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-af-border" />
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
              Not Arriving at {state} Mandis Today
            </span>
            <div className="h-px flex-1 bg-af-border" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {unavailableCrops.map((c) => (
              <div
                key={c.name}
                className="relative overflow-hidden text-left rounded-2xl border border-dashed border-af-border bg-af-bg/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-af-muted">{c.name}</span>
                  <PackageX className="w-3.5 h-3.5 text-af-muted" />
                </div>
                <div className="mt-2 text-[11px] text-af-muted leading-relaxed">
                  No arrivals reported at {state} mandis today
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-af-bg border border-af-border px-2 py-0.5">
                  <span className="text-[9px] font-bold font-mono tracking-[0.15em] uppercase text-af-muted">
                    Seasonal
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-af-amber/6 border border-af-amber/20 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-af-amber shrink-0 mt-0.5" />
            <p className="text-[12px] text-af-ink-2 leading-relaxed">
              <strong className="text-af-ink">Why are some crops missing?</strong>{" "}
              Mandi arrivals depend on harvest season and regional availability.
              Crops not listed are not being traded at <strong>{state}</strong> mandis
              today according to <strong>AGMARKNET (data.gov.in)</strong>.
              Prices will appear automatically when arrivals are reported.
            </p>
          </div>
        </div>
      )}

      {/* ── Trend chart + mandi list ── */}
      {!active.notAvailable && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">

          {/* Chart */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-af-ink">{active.name}</h2>
                  <Badge tone={demandTone[active.demand]}>{active.demand} demand</Badge>
                  {active.isReal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-af-primary/10 text-af-primary-deep px-2 py-0.5 text-[9px] font-bold font-mono tracking-[0.15em] uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-af-primary animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-af-muted">
                  21-day price trend · {active.unit}
                  {active.isReal && state && (
                    <span className="ml-1 text-af-primary-deep font-semibold">· {state}</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-extrabold text-af-ink">
                  {rupee(active.price)}
                </div>
                <div className={`text-[12px] font-bold ${up ? "text-af-primary-deep" : "text-af-danger"}`}>
                  {up ? "▲" : "▼"} {up ? "+" : ""}{active.change}% today
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

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-af-muted">
              <RefreshCw className="w-3 h-3" />
              {active.isReal
                ? "Live prices from AGMARKNET · data.gov.in · refreshed every 6 hrs"
                : "Demo prices · Add DATA_GOV_API_KEY for live data"}
            </div>
          </Card>

          {/* Nearby Mandis - with expandable rows */}
          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
                <Store className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-af-ink leading-tight">
                  Nearby Mandis
                </h2>
                <p className="text-[13px] text-af-muted">
                  {active.name} · click to see fee breakdown
                  {active.isReal && state && (
                    <span className="text-af-primary-deep font-semibold"> · {state}</span>
                  )}
                </p>
              </div>
            </div>

            {mandis.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
                <Store className="w-8 h-8 text-af-muted opacity-30" />
                <p className="text-sm text-af-muted">
                  No mandi data for {active.name} in {state ?? "your region"} today.
                </p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1 -mr-1">
                {mandis.map((m, i) => (
                  <MandiItem
                    key={m.mandi}
                    mandi={m}
                    index={i}
                    isBest={i === 0}
                    cropName={active.name}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}