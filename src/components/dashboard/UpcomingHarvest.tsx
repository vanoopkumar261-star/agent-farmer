import { Wheat, Sprout } from "lucide-react";
import { harvestInfo } from "@/lib/agronomy";
import Card from "@/components/ui/Card";
import { T } from "@/components/i18n/LanguageProvider";

export type HarvestItem = {
  id: string;
  crop: string;
  seedingDate: string;
  /** The farmer's own harvest date; null falls back to the crop's cycle length. */
  estimatedHarvestDate?: string | null;
  farmIndex: number;
};

const CEREALS = ["wheat", "paddy", "rice", "maize", "bajra", "jowar", "barley", "millet"];

/**
 * Countdown to harvest for every cropped farm — one row per farm, driven by that
 * farm's own crop, seeding date and harvest date. Farms with no crop are
 * filtered out upstream, so the row count always tracks the real farm count.
 */
export default function UpcomingHarvest({ items }: { items: HarvestItem[] }) {
  if (items.length === 0) return null;

  const rows = items
    .map((it) => ({ ...it, ...harvestInfo(it.crop, it.seedingDate, it.estimatedHarvestDate) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink"><T k="upcomingHarvest.title" /></h2>

      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const Icon = CEREALS.includes(r.crop.toLowerCase()) ? Wheat : Sprout;
          return (
            <li key={r.id} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-[12px] bg-af-sage text-af-primary-deep shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-af-ink leading-tight">
                  {r.crop} <span className="text-af-muted font-semibold"><T k="upcomingHarvest.farmSuffix" params={{ n: String(r.farmIndex).padStart(2, "0") }} /></span>
                </div>
                <div className="mt-0.5 text-meta text-af-ink-2">
                  {r.daysLeft > 0 ? <T k="upcomingHarvest.inDays" params={{ n: r.daysLeft }} /> : <T k="dashboard.readyToHarvest" />}
                  <span className="text-af-muted">
                    {" "}
                    · <T k={r.estimated ? "dashboard.est" : "dashboard.planned"} /> {r.harvestLabel}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-af-sage overflow-hidden">
                  <div className="h-full rounded-full bg-af-primary" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
