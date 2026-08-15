import { Sprout, Droplets, Layers, CalendarDays } from "lucide-react";
import type { FarmWithCrop } from "@/lib/dashboard";
import { cropStage, daysSince } from "@/lib/dashboard";

export default function FarmCard({ farm }: { farm: FarmWithCrop }) {
  const crop = farm.crop;
  const stage = crop
    ? cropStage(crop.seeding_date, crop.chosen_crop, crop.estimated_harvest_date)
    : null;
  const days = crop ? daysSince(crop.seeding_date) : null;

  return (
    <div className="group rounded-2xl bg-af-card border border-af-border shadow-af-sm hover:shadow-af-md transition-all duration-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-af-sage flex items-center justify-center">
            <Sprout className="w-[18px] h-[18px] text-af-secondary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-af-ink leading-tight">Farm {farm.farm_index}</div>
            <div className="text-[11px] text-af-muted">{farm.area} acres</div>
          </div>
        </div>
        <span className="rounded-full bg-af-primary/10 text-af-primary-deep px-2.5 py-1 text-[11px] font-semibold">
          {crop?.chosen_crop ?? "No crop"}
        </span>
      </div>

      {/* Chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={<Layers className="w-3 h-3" />} text={farm.soil_type} />
        <Chip icon={<Droplets className="w-3 h-3" />} text={farm.irrigation} />
        {crop && (
          <Chip icon={<CalendarDays className="w-3 h-3" />} text={`Seeded ${crop.seeding_date}`} />
        )}
      </div>

      {/* Stage progress */}
      {stage && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-af-ink-2">{stage.label}</span>
            <span className="font-mono text-[11px] text-af-muted">Day {days}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-af-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-af-primary"
              style={{ width: `${Math.round(stage.progress * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-af-bg border border-af-border px-2.5 py-1 text-[11px] font-semibold text-af-ink-2">
      {icon}
      {text}
    </span>
  );
}
