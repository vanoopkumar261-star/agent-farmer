"use client";

import { AlertTriangle, CircleAlert, Loader2 } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import type { FeasibilityState } from "./useCropFeasibility";

/**
 * The verdict, shown under the freehand crop box.
 *
 * Three states worth rendering, and one worth staying silent about:
 *
 *   unsuitable → red. The save is blocked, so this must say which condition is
 *                wrong and offer crops that do suit the field. A refusal with
 *                no way forward is just an obstacle.
 *   caution    → amber. The crop will grow; something will hold the yield back.
 *                Saving is allowed — this is information, not a gate.
 *   checking   → a quiet line while the model is asked about an unknown name.
 *   ok         → nothing. A farmer who typed a sensible crop does not need to
 *                be congratulated for it, and a green tick on every keystroke
 *                is noise.
 *
 * Reasons carry an i18n key where the engine wrote them and a bare English
 * sentence where the model did; `msgKey` empty means render `label`.
 */
export default function CropFeasibilityNotice({
  state,
  onPickAlternative,
}: {
  state: FeasibilityState;
  /** Lets the farmer take a suggested crop with one tap. */
  onPickAlternative?: (crop: string) => void;
}) {
  const { t } = useT();
  const { result, checking } = state;

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-af-muted">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("feasibility.checking")}
      </div>
    );
  }

  if (!result || result.verdict === "ok" || result.verdict === "unknown") return null;

  const blocking = result.verdict === "unsuitable";
  const Icon = blocking ? CircleAlert : AlertTriangle;

  return (
    <div
      role={blocking ? "alert" : "status"}
      className={`rounded-[14px] border px-3 py-2.5 ${
        blocking
          ? "border-af-danger/35 bg-af-danger/[0.07]"
          : "border-af-warn/35 bg-af-warn/[0.07]"
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-[2px] h-3.5 w-3.5 shrink-0 ${blocking ? "text-af-danger" : "text-af-warn"}`}
        />
        <div className="min-w-0 space-y-1">
          <p
            className={`text-[12px] font-semibold ${
              blocking ? "text-af-danger" : "text-af-ink"
            }`}
          >
            {blocking
              ? t("feasibility.blockedTitle", { crop: result.crop })
              : t("feasibility.cautionTitle", { crop: result.crop })}
          </p>

          <ul className="space-y-0.5">
            {result.reasons.map((r, i) => (
              <li key={i} className="text-[11.5px] leading-snug text-af-ink-2">
                {r.msgKey ? t(r.msgKey, r.params as Record<string, string | number>) : r.label}
              </li>
            ))}
          </ul>

          {blocking && result.alternatives.length > 0 && (
            <div className="pt-1">
              <span className="text-[11px] text-af-muted">{t("feasibility.tryInstead")}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.alternatives.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => onPickAlternative?.(alt)}
                    className="rounded-full border border-af-border bg-af-surface px-2.5 py-1 text-[11px] font-medium text-af-ink transition hover:border-af-primary/40 hover:text-af-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
