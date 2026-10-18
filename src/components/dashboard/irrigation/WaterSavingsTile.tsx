"use client";

/**
 * Water saved against the habit this feature exists to replace: irrigating on
 * a fixed calendar, refilling the whole root zone, ignoring the forecast.
 *
 * The provenance line is not optional decoration. This is a modelled
 * comparison between two schedules on the same week's weather — nobody's pump
 * was metered — and the engine refuses to produce a figure at all unless it
 * can point at what produced it (a run smaller than a full refill, or one the
 * rain let us skip). Showing the number without the sentence would make it a
 * claim rather than an estimate.
 */

import { TrendingDown } from "lucide-react";
import Card from "@/components/ui/Card";
import CountUp from "@/components/ui/CountUp";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan } from "@/lib/irrigation";

export default function WaterSavingsTile({ plan }: { plan: IrrigationPlan }) {
  const { t } = useT();
  const s = plan.savings;

  if (!s) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-af-muted">
          <TrendingDown className="w-4 h-4" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">
            {t("irrigation.savings.label")}
          </span>
        </div>
        <div className="mt-2 text-2xl font-semibold text-af-ink">—</div>
        <div className="mt-1 text-xs text-af-muted">
          {t("irrigation.savings.nothingYet")}
        </div>
      </Card>
    );
  }

  const thousands = s.litresSaved / 1000;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-af-muted">
        <TrendingDown className="w-4 h-4" />
        <span className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">
          {t("irrigation.savings.label")}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-af-ink">
        <CountUp value={thousands} decimals={thousands < 10 ? 1 : 0} suffix="k L" />
      </div>
      <div className="mt-1 text-xs text-af-muted">
        {/*
          `vsBaseline` arrives already translated — the server ran it through
          `localiseIrrigationPlans` before this rendered, because the engine
          composes it from the farm's own delivery method.
        */}
        {t("irrigation.savings.lessThan", { pct: s.percentSaved, baseline: s.vsBaseline })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-af-muted border-t border-af-border pt-2">
        {s.provenance}
      </p>
    </Card>
  );
}
