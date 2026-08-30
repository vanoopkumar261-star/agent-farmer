"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Sparkline from "./Sparkline";
import CountUp from "@/components/ui/CountUp";
import TrendDelta from "@/components/ui/TrendDelta";
import Card from "@/components/ui/Card";

/**
 * Stat tile in the "New version" layout: value top-left, outlined glyph
 * top-right, then a footer that is either a context line ("Across 2 farms") or
 * a drill-in link ("View all farms →"). Falls back to the original sparkline
 * footer when neither is supplied, so existing pages keep their look.
 */
export default function StatTile({
  icon,
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  delta,
  positiveIsGood = true,
  meta,
  link,
  spark,
  sparkColor = "currentColor",
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta?: number;
  positiveIsGood?: boolean;
  /** Context line under the label, e.g. "Across 2 farms". */
  meta?: React.ReactNode;
  /** Drill-in link under the label. Takes precedence over `meta`. */
  link?: { label: React.ReactNode; href: string };
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    // v2: the tile is now the shared Card surface rather than a hand-rolled copy
    // of it, so radius/border/shadow/hover stay in one place. The white gradient
    // top edge and the -translate-y lift are gone for the same reason Card
    // dropped them — both were lighting cues, and separation comes from the
    // border now.
    <Card hover className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[26px] leading-none font-semibold tracking-[-0.02em] text-af-ink">
            <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </div>
          <div className="mt-2 text-label font-semibold text-af-muted uppercase">
            {label}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-af-primary">{icon}</span>
          {delta !== undefined && <TrendDelta value={delta} positiveIsGood={positiveIsGood} />}
        </div>
      </div>

      {link ? (
        <Link
          href={link.href}
          className="mt-3 inline-flex items-center gap-1.5 text-meta font-semibold text-af-primary-deep hover:gap-2.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 rounded"
        >
          {link.label}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : meta ? (
        <div className="mt-3 text-meta text-af-ink-2 truncate">{meta}</div>
      ) : spark ? (
        <div className="mt-3 -mx-1">
          <Sparkline data={spark} color={sparkColor} height={32} />
        </div>
      ) : null}
    </Card>
  );
}
