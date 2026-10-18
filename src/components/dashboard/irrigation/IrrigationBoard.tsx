"use client";

/**
 * The irrigation page's interactive shell.
 *
 * Everything numeric arrives already computed from the server — the plan per
 * farm, built by `computeIrrigationPlan()` against Open-Meteo's forecast. This
 * component picks which farm is in focus, overlays the live soil-moisture
 * probe, and renders. It does not do agronomy.
 *
 * One farm at a time rather than every farm stacked: a holding can have six
 * plots on different crops, soils and methods, and six depletion curves on one
 * page is unreadable. The tab strip carries a dot for any farm that needs
 * water today, so nothing urgent is hidden behind a tab.
 */

import { useEffect, useMemo, useState } from "react";
import { Droplets, Gauge, Waves, Info } from "lucide-react";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan } from "@/lib/irrigation";
import type { SensorSnapshot } from "@/app/api/sensors/route";
import MoistureForecastChart from "./MoistureForecastChart";
import IrrigationVerdictCard from "./IrrigationVerdictCard";
import IrrigationSchedule from "./IrrigationSchedule";
import RainfedAdvisory from "./RainfedAdvisory";
import WaterSavingsTile from "./WaterSavingsTile";
import IrrigationLog from "./IrrigationLog";
import IrrigationAdvice from "./IrrigationAdvice";
import type { IrrigationEventRow } from "@/lib/history";

/**
 * `farmIndex` and `cropName` rather than ready-made labels.
 *
 * The server knows the farm is number two and is growing wheat; it does not
 * know which of nine languages the farmer reads, because the language lives in
 * a client context. So the raw facts cross the boundary and the wording is
 * chosen here, where `t()` is available.
 */
export type FarmPlan = {
  farmId: string;
  farmIndex: number;
  cropName: string | null;
  plan: IrrigationPlan;
  events: IrrigationEventRow[];
};

export default function IrrigationBoard({
  farmerId,
  farmPlans,
}: {
  farmerId: string;
  farmPlans: FarmPlan[];
}) {
  const { t } = useT();
  const [activeId, setActiveId] = useState(farmPlans[0]?.farmId ?? "");
  const [sensorPct, setSensorPct] = useState<number | null>(null);
  const [sensorAt, setSensorAt] = useState<string | null>(null);

  /**
   * Live soil moisture from the existing ThingSpeak route.
   *
   * Read-only garnish, deliberately: the plans were computed server-side
   * without it, so a slow or dead probe can never delay or alter the advice on
   * screen. It is shown beside the modelled curve as a second opinion, and
   * labelled as the shared demo rig because that is what it currently is —
   * one channel serving every account, not this farm's own sensor.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sensors", { cache: "no-store" });
        if (!res.ok) return;
        const snap = (await res.json()) as SensorSnapshot;
        const m = snap.metrics.find((x) => x.key === "soilMoisture");
        if (cancelled || !m?.configured || !m.latest) return;
        setSensorPct(m.latest.value);
        setSensorAt(m.latest.at);
      } catch {
        // A missing probe is a normal state, not a fault.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => farmPlans.find((f) => f.farmId === activeId) ?? farmPlans[0],
    [farmPlans, activeId]
  );

  if (!farmPlans.length) {
    return (
      <EmptyState
        icon={<Droplets className="w-5 h-5" />}
        title={t("irrigation.board.noFarms")}
        body={t("irrigation.board.noFarmsBody")}
      />
    );
  }

  const p = active.plan;
  const rainfed = p.regime === "rainfed";
  const activeLabel = t("farmCard.title", { n: active.farmIndex });
  const activeCropLabel = active.cropName ?? t("irrigation.page.noCropSown");

  return (
    <div className="space-y-6">
      {farmPlans.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs
            tabs={farmPlans.map((f) => ({
              id: f.farmId,
              // A dot, not a count — the tab strip has to stay scannable, and
              // "needs water" is binary from here.
              label: `${t("farmCard.title", { n: f.farmIndex })}${
                f.plan.verdict === "irrigate_today" ? " •" : ""
              }`,
            }))}
            active={active.farmId}
            onChange={setActiveId}
          />
          <span className="text-xs text-af-muted">{activeCropLabel}</span>
        </div>
      )}

      <IrrigationVerdictCard plan={p} />

      <IrrigationAdvice plan={p} />

      {!rainfed && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-af-muted">
              <Gauge className="w-4 h-4" />
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
                {t("irrigation.board.soilWaterNow")}
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-af-ink">{p.availablePct}%</div>
            <div className="mt-1 text-xs text-af-muted">
              {t("irrigation.board.ofCapacity", { mm: p.taw })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-af-muted">
              <Waves className="w-4 h-4" />
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase">
                {t("irrigation.board.usingToday")}
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-af-ink">{p.etcToday} mm</div>
            <div className="mt-1 text-xs text-af-muted">
              {t("irrigation.board.cropAtStage", {
                crop: p.cropName ?? t("irrigation.thisCrop"),
                stage: p.stage?.label.toLowerCase() ?? "",
              })}
            </div>
          </Card>

          <WaterSavingsTile plan={p} />
        </div>
      )}

      {rainfed ? (
        <RainfedAdvisory plan={p} />
      ) : (
        <>
          <MoistureForecastChart plan={p} sensorPct={sensorPct} sensorAt={sensorAt} />
          <IrrigationSchedule plan={p} />
        </>
      )}

      <IrrigationLog
        farmerId={farmerId}
        farmId={active.farmId}
        farmLabel={activeLabel}
        events={active.events}
        suggestedMm={p.grossMm || undefined}
        suggestedLitres={p.volumeLitres || undefined}
        suggestedMinutes={p.runMinutes || undefined}
      />

      {/*
        Provenance, stated once at the foot of the page rather than hedged into
        every tile. Un-measured inputs declare themselves here for the same
        reason npk.ts declares its assumed sufficiency levels inside the prompt:
        advice a farmer spends money on has to say what it was built from.
      */}
      <Card className="p-4">
        <div className="flex gap-3">
          <Info className="w-4 h-4 text-af-muted shrink-0 mt-0.5" />
          <div className="text-xs text-af-ink-2 space-y-1">
            <p>
              {/* `soilNote` is engine prose, already translated server-side. */}
              {t("irrigation.board.provenance", { soil: active.plan.soilNote })}
            </p>
            <p>
              {p.balanceSource === "sensor"
                ? t("irrigation.board.startSensor")
                : p.balanceSource === "modelled"
                  ? t("irrigation.board.startModelled")
                  : t("irrigation.board.startAssumed")}
              {p.efficiencyAssumed && ` ${t("irrigation.board.assumedEfficiency")}`}
            </p>
            {sensorAt && (
              <p className="text-af-muted">{t("irrigation.board.sharedRig")}</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
