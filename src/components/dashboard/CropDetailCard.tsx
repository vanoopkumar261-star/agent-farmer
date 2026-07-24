import { Sprout, Droplets, Layers, CalendarDays, CalendarClock } from "lucide-react";
import Card from "@/components/ui/Card";
import type { FarmWithCrop } from "@/lib/dashboard";
import { cropStage, daysSince } from "@/lib/dashboard";

const STAGES = ["Germination", "Seedling", "Vegetative", "Flowering", "Maturity"];

export default function CropDetailCard({ farm }: { farm: FarmWithCrop }) {
  const crop = farm.crop;

  if (!crop) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg text-af-muted">
            <Sprout className="w-[18px] h-[18px]" />
          </span>
          <div>
            <div className="text-sm font-bold text-af-ink">Farm {farm.farm_index}</div>
            <div className="text-[12px] text-af-muted">No crop selected yet</div>
          </div>
        </div>
      </Card>
    );
  }

  const stage = cropStage(crop.seeding_date);
  const days = daysSince(crop.seeding_date);
  const currentStageIdx = STAGES.indexOf(stage.label);
  const harvest = new Date(new Date(crop.seeding_date).getTime() + 120 * 86_400_000);
  const daysLeft = Math.max(0, Math.ceil((harvest.getTime() - Date.now()) / 86_400_000));
  const health = Math.max(60, Math.min(96, 78 + Math.round(stage.progress * 12)));

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
            <Sprout className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-af-ink">{crop.chosen_crop}</h3>
              <span className="rounded-full bg-af-primary/10 text-af-primary-deep px-2.5 py-0.5 text-[11px] font-bold">
                Farm {farm.farm_index}
              </span>
            </div>
            <div className="text-[12px] text-af-muted">Day {days} · {stage.label} stage</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-extrabold text-af-ink">{health}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-af-muted">Health</div>
        </div>
      </div>

      {/* chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={<Layers className="w-3 h-3" />} text={farm.soil_type} />
        <Chip icon={<Droplets className="w-3 h-3" />} text={farm.irrigation} />
        <Chip icon={<CalendarDays className="w-3 h-3" />} text={`${farm.area} acres`} />
        <Chip icon={<CalendarDays className="w-3 h-3" />} text={`Seeded ${crop.seeding_date}`} />
      </div>

      {/* growth timeline */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
            Growth Timeline
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-ink-2">
            <CalendarClock className="w-3.5 h-3.5 text-af-primary" /> ~{daysLeft} days to harvest
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-[11px] left-0 right-0 h-0.5 bg-af-border" />
          <div
            className="absolute top-[11px] left-0 h-0.5 bg-af-primary transition-all"
            style={{ width: `${(currentStageIdx / (STAGES.length - 1)) * 100}%` }}
          />
          <div className="relative flex justify-between">
            {STAGES.map((s, i) => {
              const done = i <= currentStageIdx;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5" style={{ width: 0 }}>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      done ? "bg-af-primary border-af-primary" : "bg-af-card border-af-border"
                    }`}
                  >
                    {done && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${done ? "text-af-ink" : "text-af-muted"}`}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
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
