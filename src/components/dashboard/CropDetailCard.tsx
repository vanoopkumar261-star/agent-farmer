import { Sprout, Droplets, Layers, CalendarDays, CalendarClock } from "lucide-react";
import Card from "@/components/ui/Card";
import type { FarmWithCrop } from "@/lib/dashboard";
import { cropStageFor, harvestInfo, stageTimelinePct, STAGE_LABELS } from "@/lib/agronomy";
import HarvestDateEditor from "@/components/dashboard/HarvestDateEditor";
import DeleteFarmButton from "@/components/dashboard/DeleteFarmButton";
import { T } from "@/components/i18n/LanguageProvider";

const STAGES = STAGE_LABELS;

export default function CropDetailCard({ farm, health: healthProp }: { farm: FarmWithCrop; health?: number }) {
  const crop = farm.crop;

  if (!crop) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg text-af-muted">
              <Sprout className="w-[18px] h-[18px]" />
            </span>
            <div>
              <div className="text-sm font-semibold text-af-ink"><T k="farmCard.title" params={{ n: farm.farm_index }} /></div>
              <div className="text-[12px] text-af-muted"><T k="dashboard.stat.noCropSelected" /></div>
            </div>
          </div>
          {/* A cropless farm is the most likely leftover, so it needs the
              control at least as much as a planted one. */}
          <DeleteFarmButton farmId={farm.id} farmIndex={farm.farm_index} />
        </div>
      </Card>
    );
  }

  const stage = cropStageFor(crop.chosen_crop, crop.seeding_date, crop.estimated_harvest_date);
  const days = stage.day;
  const currentStageIdx = STAGES.indexOf(stage.label);
  const { daysLeft, harvestLabel, estimated } = harvestInfo(
    crop.chosen_crop,
    crop.seeding_date,
    crop.estimated_harvest_date
  );
  // Prefer a real weather-aware health score from the page; fall back to a
  // stage-based estimate when it isn't supplied.
  const health = healthProp ?? Math.max(60, Math.min(96, 78 + Math.round(stage.progress * 12)));

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
            <Sprout className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-af-ink">{crop.chosen_crop}</h3>
              <span className="rounded-full bg-af-primary/10 text-af-primary-deep px-2.5 py-0.5 text-[11px] font-semibold">
                <T k="farmCard.title" params={{ n: farm.farm_index }} />
              </span>
            </div>
            <div className="text-[12px] text-af-muted"><T k="cropDetailCard.dayStage" params={{ n: days, stage: stage.label }} /></div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className="font-mono text-2xl font-semibold text-af-ink">{health}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-af-muted"><T k="cropDetailCard.health" /></div>
          </div>
          <DeleteFarmButton
            farmId={farm.id}
            farmIndex={farm.farm_index}
            cropName={crop.chosen_crop}
          />
        </div>
      </div>

      {/* chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={<Layers className="w-3 h-3" />} text={farm.soil_type} />
        <Chip icon={<Droplets className="w-3 h-3" />} text={farm.irrigation} />
        <Chip icon={<CalendarDays className="w-3 h-3" />} text={<T k="cropDetailCard.acres" params={{ n: farm.area }} />} />
        <Chip icon={<CalendarDays className="w-3 h-3" />} text={<T k="farmCard.seeded" params={{ date: crop.seeding_date }} />} />
      </div>

      {/* growth timeline */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
            <T k="cropDetailCard.growthTimeline" />
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-ink-2">
            <CalendarClock className="w-3.5 h-3.5 text-af-primary" />
            {daysLeft > 0 ? <T k="cropDetailCard.daysToHarvest" params={{ n: daysLeft }} /> : <T k="dashboard.readyToHarvest" />}
            <span className="text-af-muted">
              · <T k={estimated ? "dashboard.est" : "dashboard.planned"} /> {harvestLabel}
            </span>
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-[11px] left-0 right-0 h-0.5 bg-af-border" />
          {/* Driven by real elapsed days, not the stage index. Anchoring it to
              the index meant the line jumped only five times in a 100-day
              cycle and looked frozen for a fortnight at a stretch; now it
              creeps forward every single day the farmer signs in. */}
          <div
            className="absolute top-[11px] left-0 h-0.5 bg-af-primary transition-all"
            style={{ width: `${stageTimelinePct(stage.progress)}%` }}
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

      <HarvestDateEditor
        cropCycleId={crop.id}
        cropName={crop.chosen_crop}
        seedingDate={crop.seeding_date}
        estimatedHarvestDate={crop.estimated_harvest_date}
      />
    </Card>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-af-bg border border-af-border px-2.5 py-1 text-[11px] font-semibold text-af-ink-2">
      {icon}
      {text}
    </span>
  );
}
