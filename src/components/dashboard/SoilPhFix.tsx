"use client";

import Link from "next/link";
import { MapPin, ArrowRight, Sprout, Clock, Info } from "lucide-react";
import Card from "@/components/ui/Card";
import { useT } from "@/components/i18n/LanguageProvider";
import { phBand } from "@/lib/soilPh";
import { soilFix, type SoilAction } from "@/lib/soilFix";
import { cropStageFor, getCropProfile } from "@/lib/agronomy";

export type FixFarm = {
  farm_index: number;
  soil_type: string;
  crop: { chosen_crop: string; seeding_date: string; estimated_harvest_date: string | null } | null;
};

/**
 * What to do about the measured pH, for the crop that is actually growing.
 *
 * This replaced a panel that answered "which crops would suit this pH". That
 * question is useless to the person asking it — someone ninety days into wheat
 * cannot switch crops, and being told paddy would have been a better choice is
 * worse than being told nothing. The farm already knows its crop and sowing
 * date; the page was simply throwing both away.
 */
export default function SoilPhFix({ ph, farms }: { ph: number; farms: FixFarm[] }) {
  const { t } = useT();
  const band = phBand(ph);

  if (farms.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <Sprout className="w-4 h-4 text-af-primary" />
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">
          {t("soilFix.title")}
        </h2>
        <span className="font-mono text-[11px] font-semibold" style={{ color: band.color }}>
          {t("soilFix.yourPh", { ph: ph.toFixed(1) })}
        </span>
      </div>

      {farms.map((f) => (
        <FarmFix key={f.farm_index} ph={ph} farm={f} />
      ))}

      {/* Doses are a starting figure for a farmer with no lab report. Saying so
          beside them is not boilerplate — this panel is telling someone to buy
          several hundred kilos of something. */}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-af-muted">
        <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />
        {t("soilFix.caveat")}
      </p>
    </div>
  );
}

function FarmFix({ ph, farm }: { ph: number; farm: FixFarm }) {
  const { t } = useT();

  const stage = farm.crop
    ? cropStageFor(farm.crop.chosen_crop, farm.crop.seeding_date, farm.crop.estimated_harvest_date)
    : null;

  const fix = soilFix({
    ph,
    crop: farm.crop?.chosen_crop,
    soilType: farm.soil_type,
    stage,
  });

  const cropName = farm.crop ? getCropProfile(farm.crop.chosen_crop).displayName : "";
  const ok = fix.status === "ok";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
          Farm {farm.farm_index}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-af-ink-2">
          <Clock className="w-3.5 h-3.5 text-af-muted" />
          {farm.crop && stage
            ? t("soilFix.forCrop", { crop: cropName, day: stage.day, cycle: stage.cycleDays })
            : t("soilFix.noCrop")}
        </div>
      </div>

      <p className="mt-1.5 text-[12px] text-af-muted">
        {t("soilFix.rangeLabel", {
          crop: cropName || t("soilFix.noCrop"),
          min: fix.phMin.toFixed(1),
          max: fix.phMax.toFixed(1),
        })}
      </p>

      {/* When a crop is standing, the heading names it — the farmer needs to see
          that this advice is about *their* wheat, not soil in the abstract. */}
      <Section
        title={
          ok
            ? t("soilFix.nowTitle")
            : fix.cropStanding
            ? t("soilFix.nowTitleStanding", { crop: cropName })
            : t("soilFix.nowTitle")
        }
        actions={fix.now}
        tone={ok ? "ok" : "now"}
      />

      {fix.afterHarvest.length > 0 && (
        <>
          {/* The reason the advice is split at all. Without this line, "after
              harvest" looks like a delay rather than a fact about chemistry. */}
          <p className="mt-4 rounded-[12px] bg-af-sage/60 px-3 py-2 text-[12px] leading-relaxed text-af-ink-2">
            {t("soilFix.cannotFixNow")}
          </p>
          <Section title={t("soilFix.afterTitle")} actions={fix.afterHarvest} tone="later" />
        </>
      )}

      {!ok && (
        <Link
          href="/dashboard/store-locator"
          className="group mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-af-primary/20 bg-af-primary/[0.06] px-3.5 py-2.5 transition hover:border-af-primary/40 hover:bg-af-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
        >
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 shrink-0 text-af-primary-deep" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-af-ink">
                {t("soilFix.findShop")}
              </span>
              <span className="block text-[11px] text-af-ink-2">{t("soilFix.findShopSub")}</span>
            </span>
          </span>
          <ArrowRight className="w-4 h-4 shrink-0 text-af-primary-deep transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </Card>
  );
}

function Section({
  title,
  actions,
  tone,
}: {
  title: string;
  actions: SoilAction[];
  tone: "ok" | "now" | "later";
}) {
  const { t } = useT();
  if (actions.length === 0) return null;

  const dot =
    tone === "ok" ? "bg-af-primary" : tone === "now" ? "bg-af-amber" : "bg-af-muted";

  return (
    <div className="mt-4">
      <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
        {title}
      </div>
      <ul className="mt-2 space-y-2">
        {actions.map((a, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="text-sm leading-relaxed text-af-ink-2">{t(a.key, a.params)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
