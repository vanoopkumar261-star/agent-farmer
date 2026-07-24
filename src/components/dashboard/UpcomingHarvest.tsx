import { CalendarClock, Sprout } from "lucide-react";
import Sheen from "@/components/ui/Sheen";

/** Countdown to expected harvest (~120-day cycle from seeding). */
export default function UpcomingHarvest({
  crop,
  seedingDate,
  farmIndex,
}: {
  crop: string;
  seedingDate: string;
  farmIndex: number;
}) {
  const seeded = new Date(seedingDate).getTime();
  const harvest = seeded + 120 * 86_400_000;
  const daysLeft = Math.max(0, Math.ceil((harvest - Date.now()) / 86_400_000));
  const elapsed = Math.min(120, Math.max(0, Math.round((Date.now() - seeded) / 86_400_000)));
  const pct = Math.round((elapsed / 120) * 100);
  const harvestLabel = new Date(harvest).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
      <div className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full bg-af-primary/25 blur-2xl" />
      <Sheen />
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-white/80">
          <CalendarClock className="w-4 h-4" />
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase">Upcoming Harvest</span>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <span className="font-mono text-4xl font-extrabold leading-none">{daysLeft}</span>
          <span className="text-sm font-semibold text-white/75 mb-1">days left</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
          <Sprout className="w-3.5 h-3.5 text-af-primary" />
          {crop} · Farm {farmIndex}
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-af-primary to-af-leaf"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span>{pct}% grown</span>
          <span>Est. {harvestLabel}</span>
        </div>
      </div>
    </div>
  );
}
