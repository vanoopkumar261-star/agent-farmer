"use client";

/**
 * The plan, said out loud in the farmer's own language.
 *
 * Every figure in the prose was computed by the engine and handed to the model
 * as fact — `/api/irrigation-advice` will not let it produce a number of its
 * own. What Groq adds is the part the engine is bad at: phrasing the action in
 * nine languages, warmly, in words a farmer actually uses.
 *
 * Loaded after paint and allowed to fail. The numbers above this panel are the
 * advice; this is the sentence around them, and a farmer who never sees it has
 * lost nothing they need.
 */

import { useEffect, useState } from "react";
import { MessageSquareQuote, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import SpeakButton from "@/components/dashboard/SpeakButton";
import { useT } from "@/components/i18n/LanguageProvider";
import type { IrrigationPlan } from "@/lib/irrigation";

type Advice = { headline: string; why: string; tips: string[] };

export default function IrrigationAdvice({ plan }: { plan: IrrigationPlan }) {
  const { locale, t } = useT();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);

  // Keyed on the farm and the verdict so switching tabs refetches, but a
  // re-render does not.
  const key = `${plan.farmId ?? plan.farmIndex}:${plan.verdict}:${locale}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAdvice(null);

    const rain3 = plan.forecast.slice(0, 3).reduce((s, d) => s + d.rainMm, 0);

    (async () => {
      try {
        const res = await fetch("/api/irrigation-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farmIndex: plan.farmIndex,
            crop: plan.cropName,
            stage: plan.stage?.label,
            verdict: plan.verdict,
            status: plan.status,
            grossMm: plan.grossMm,
            volumeLitres: plan.volumeLitres,
            runMinutes: plan.runMinutes,
            availablePct: plan.availablePct,
            etcToday: plan.etcToday,
            rainMm: Math.round(rain3 * 10) / 10,
            regime: plan.regime,
            method: plan.method,
            soil: plan.soilNote,
            savedLitres: plan.savings?.litresSaved ?? 0,
            assumedStart: plan.balanceSource === "assumed",
            locale,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { advice: Advice | null };
        if (!cancelled && data.advice?.headline) setAdvice(data.advice);
      } catch {
        // Silence is the correct failure here.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-af-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("irrigation.advice.loading")}
        </div>
      </Card>
    );
  }

  // No panel at all rather than an apology — the page is complete without it.
  if (!advice) return null;

  const spoken = [advice.headline, advice.why, ...advice.tips].join(". ");

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-[12px] bg-af-ai/10 text-af-ai shrink-0">
            <MessageSquareQuote className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-semibold text-af-ink">{advice.headline}</h3>
            <p className="mt-1 text-sm text-af-ink-2">{advice.why}</p>
          </div>
        </div>
        <SpeakButton text={spoken} locale={locale} />
      </div>

      {advice.tips.length > 0 && (
        <ul className="mt-4 space-y-1.5 pl-12">
          {advice.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-af-ink-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-af-ai shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
