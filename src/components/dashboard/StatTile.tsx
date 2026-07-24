"use client";

import React from "react";
import Sparkline from "./Sparkline";
import CountUp from "@/components/ui/CountUp";
import TrendDelta from "@/components/ui/TrendDelta";

export default function StatTile({
  icon,
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  delta,
  positiveIsGood = true,
  spark,
  sparkColor = "#10B981",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta?: number;
  positiveIsGood?: boolean;
  spark: number[];
  sparkColor?: string;
}) {
  return (
    <div className="af-spotlight relative overflow-hidden rounded-2xl bg-af-card border border-af-border shadow-af-sm p-5 transition-all duration-200 hover:shadow-af-md hover:-translate-y-0.5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <div className="flex items-start justify-between">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">
          {icon}
        </span>
        {delta !== undefined && <TrendDelta value={delta} positiveIsGood={positiveIsGood} />}
      </div>

      <div className="mt-3 font-mono text-2xl font-extrabold text-af-ink">
        <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="text-[11px] font-semibold text-af-muted uppercase tracking-wide mt-0.5">
        {label}
      </div>

      <div className="mt-3 -mx-1">
        <Sparkline data={spark} color={sparkColor} height={32} />
      </div>
    </div>
  );
}
