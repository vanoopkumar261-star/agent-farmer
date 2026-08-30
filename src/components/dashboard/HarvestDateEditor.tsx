"use client";

/**
 * Inline editor for a farm's estimated harvest date, mounted inside the (server)
 * crop detail card.
 *
 * The date is per crop cycle, so editing here changes only that farm. Saving
 * refreshes the route so the countdown, growth stage, tasks and alerts that
 * derive from this date all update together. Clearing it hands the farm back to
 * the agronomy engine's estimate rather than leaving a blank.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, RotateCcw } from "lucide-react";
import { updateEstimatedHarvestDate } from "@/lib/db";
import { suggestHarvestDate } from "@/lib/agronomy";
import { useT } from "@/components/i18n/LanguageProvider";

type Props = {
  cropCycleId: string;
  cropName: string;
  seedingDate: string;
  /** Null when the farmer hasn't set one — the field then shows the engine's estimate. */
  estimatedHarvestDate: string | null;
};

export default function HarvestDateEditor({
  cropCycleId,
  cropName,
  seedingDate,
  estimatedHarvestDate,
}: Props) {
  const router = useRouter();
  const { t } = useT();
  const suggested = suggestHarvestDate(cropName, seedingDate);

  const [value, setValue] = useState(estimatedHarvestDate ?? suggested);
  const [isCustom, setIsCustom] = useState(estimatedHarvestDate != null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string | null) => {
    // A harvest before seeding would invert every countdown that reads this date.
    if (next && next <= seedingDate) {
      setError(t("harvestDateEditor.invalidDate"));
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("saving");
    const ok = await updateEstimatedHarvestDate(cropCycleId, next);

    if (!ok) {
      setStatus("error");
      setError(t("harvestDateEditor.saveError"));
      return;
    }

    setIsCustom(next != null);
    setValue(next ?? suggested);
    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
  };

  return (
    <div className="mt-5 pt-5 border-t border-af-border">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor={`harvest-${cropCycleId}`}
            className="block font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted"
          >
            {t("addFarmModal.estHarvestDate")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`harvest-${cropCycleId}`}
              type="date"
              value={value}
              min={seedingDate}
              onChange={(e) => {
                setValue(e.target.value);
                setStatus("idle");
                setError(null);
              }}
              onBlur={(e) => {
                // Only write when the value actually moved.
                if (e.target.value && e.target.value !== (estimatedHarvestDate ?? suggested)) {
                  save(e.target.value);
                }
              }}
              className="rounded-[12px] bg-af-card border border-af-border px-3 py-2 text-meta font-semibold text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
            />

            {isCustom && (
              <button
                type="button"
                onClick={() => save(null)}
                title="Reset to the estimate from this crop's growing cycle"
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-af-border bg-af-bg px-2.5 py-2 text-[11px] font-semibold text-af-ink-2 hover:text-af-ink transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("harvestDateEditor.reset")}
              </button>
            )}
          </div>
        </div>

        <div className="pb-1 text-[11px]">
          {status === "saving" ? (
            <span className="inline-flex items-center gap-1.5 text-af-ink-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("harvestDateEditor.saving")}
            </span>
          ) : status === "saved" ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-af-primary-deep">
              <Check className="w-3.5 h-3.5" /> {t("harvestDateEditor.saved")}
            </span>
          ) : error ? (
            <span className="font-semibold text-af-danger">{error}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-af-muted">
              <CalendarClock className="w-3.5 h-3.5" />
              {isCustom ? t("harvestDateEditor.yourDate") : t("harvestDateEditor.estimatedFrom", { crop: cropName })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
