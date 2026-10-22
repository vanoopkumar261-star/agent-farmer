"use client";

import Link from "next/link";
import { Droplets, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { useT } from "@/components/i18n/LanguageProvider";
import { SEVERITY } from "@/lib/chartTheme";
import { REGIME_KEY } from "@/lib/irrigationCatalog";
import type { IrrigationPlan } from "@/lib/irrigation";

/**
 * Today's watering answer on the home page, with a link into the full plan.
 *
 * Takes the plans already computed by the dashboard rather than recomputing:
 * two water balances on one page could disagree, and the farmer would have no
 * way to tell which one to believe.
 *
 * Shows the farm that needs attention most — irrigating beats a warning beats
 * "all fine" — because the card has room for one answer and a holding with six
 * plots still only needs to know where to walk first.
 */
export default function IrrigationCard({ plans }: { plans: IrrigationPlan[] }) {
  const { t } = useT();

  if (!plans.length) return null;

  const rank = (p: IrrigationPlan) =>
    p.verdict === "irrigate_today" ? 0 : p.status === "critical" ? 1 : p.status === "over_irrigated" ? 2 : 3;
  const lead = [...plans].sort((a, b) => rank(a) - rank(b))[0];

  const needsWater = lead.verdict === "irrigate_today";
  const alarmed = lead.status === "critical" || lead.status === "over_irrigated";
  const accent = needsWater ? undefined : alarmed ? SEVERITY.orange : undefined;

  const litres = lead.volumeLitres;
  const litreLabel =
    litres >= 1000 ? `${Math.round(litres / 1000).toLocaleString("en-IN")}k L` : `${Math.round(litres)} L`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-primary">
            <Droplets className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("nav.irrigation")}
            </h2>
            <p className="text-[12px] text-af-muted">
              {[t("farmCard.title", { n: lead.farmIndex }), lead.cropName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/irrigation"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-af-primary-deep hover:underline shrink-0"
        >
          {t("irrigation.card.fullPlan")}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {needsWater ? (
        <div className="mt-4 flex items-end gap-4">
          <div>
            <div className="text-4xl font-semibold tabular-nums leading-none text-af-ink">
              {lead.grossMm}
              <span className="text-lg font-medium text-af-muted ml-1">mm</span>
            </div>
            <div className="mt-1.5 text-[12px] font-semibold text-af-primary-deep">
              {t("irrigation.card.waterToday", { litres: litreLabel })}
            </div>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-[12px] text-af-muted">{t("irrigation.card.soilWater")}</div>
            <div className="text-xl font-semibold tabular-nums text-af-ink">{lead.availablePct}%</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold leading-tight" style={accent ? { color: accent } : undefined}>
              {lead.verdict === "rain_coming"
                ? t("irrigation.card.rainComing")
                : lead.verdict === "no_crop"
                  ? t("irrigation.card.noCrop")
                  : lead.verdict === "no_data"
                    ? t("irrigation.card.syncing")
                    : lead.status === "critical"
                      ? t("irrigation.card.short")
                      : lead.status === "over_irrigated"
                        ? t("irrigation.card.waterlogged")
                        : t("irrigation.card.noWatering")}
            </div>
            <div className="mt-1 text-[12px] text-af-muted">
              {/*
                `irrigationLabel` comes from irrigationCatalog.ts, which already
                carries a translated key per source and method — so the rain-fed
                case uses the same key the onboarding flow does, rather than a
                second, differently-worded Hindi for the same term.
              */}
              {lead.regime === "rainfed" ? t(REGIME_KEY.rainfed) : lead.irrigationLabel}
            </div>
          </div>
          {lead.taw > 0 && (
            <div className="text-right shrink-0">
              <div className="text-[12px] text-af-muted">{t("irrigation.card.soilWater")}</div>
              <div className="text-xl font-semibold tabular-nums text-af-ink">{lead.availablePct}%</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
