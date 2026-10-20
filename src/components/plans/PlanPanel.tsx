"use client";

/**
 * "Your plan" in Settings — what the farmer is on, what they have used this
 * month, and how to change it.
 *
 * The meters are the honest half of a quota. A farmer who is about to be
 * refused their fourth scan should be able to see that coming rather than
 * discover it with a leaf photo already taken, so this reads the same counters
 * the server enforces and shows them plainly.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useT } from "@/components/i18n/LanguageProvider";
import PlanChooser from "./PlanChooser";
import {
  PLANS,
  isUnlimited,
  type Cycle,
  type PlanId,
  type Quota,
} from "@/lib/plans";

type Usage = { disease_scan: number; assistant_query: number; live_lookup: number };

const METERS: { feature: keyof Usage; quota: "diseaseScans" | "assistantQueries" | "liveLookups"; labelKey: string }[] = [
  { feature: "disease_scan", quota: "diseaseScans", labelKey: "plans.f.scans" },
  { feature: "assistant_query", quota: "assistantQueries", labelKey: "plans.f.assistant" },
  { feature: "live_lookup", quota: "liveLookups", labelKey: "plans.f.liveMandi" },
];

export default function PlanPanel({
  initialPlan,
  fieldCount,
}: {
  initialPlan: PlanId;
  fieldCount: number;
}) {
  const { t } = useT();
  const router = useRouter();

  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/plan");
      if (!res.ok) return;
      const data = await res.json();
      setPlan(data.plan as PlanId);
      setUsage(data.usage as Usage);
    } catch {
      /* the panel still renders the plan it was given by the server */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (next: PlanId, cycle: Cycle) => {
    setBusyPlan(next);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: next, cycle }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 409 carries the field counts, which is the whole point of refusing
        // rather than truncating — the farmer is told exactly what to do.
        setError(data?.error ?? t("plans.error.generic"));
        return;
      }
      setPlan(data.plan as PlanId);
      setOpen(false);
      await load();
      // Locked pages and sidebar padlocks are rendered on the server, so they
      // only change once the tree is refetched.
      router.refresh();
    } catch {
      setError(t("plans.error.generic"));
    } finally {
      setBusyPlan(null);
    }
  };

  const current = PLANS[plan];

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <CreditCard className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("plans.panel.title")}
            </h2>
            <p className="text-meta text-af-muted">{t("plans.panel.subtitle")}</p>
          </div>
        </div>
        <Badge tone={plan === "free" ? "sage" : "primary"}>{t(current.nameKey)}</Badge>
      </div>

      {/* This month's usage, against what the plan allows. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {METERS.map((m) => {
          const limit: Quota = current.limits[m.quota];
          const used = usage?.[m.feature] ?? 0;
          const unlimited = isUnlimited(limit);
          const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
          const spent = !unlimited && limit > 0 && used >= limit;

          return (
            <div key={m.feature} className="rounded-[14px] border border-af-border bg-af-bg p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-af-ink-2">{t(m.labelKey)}</span>
                <span
                  className={`font-mono text-[12px] font-semibold ${spent ? "text-af-amber-ink" : "text-af-ink"}`}
                >
                  {unlimited
                    ? t("plans.v.unlimited")
                    : limit === 0
                      ? t("plans.meter.notIncluded")
                      : `${used} / ${limit}`}
                </span>
              </div>
              {!unlimited && limit > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-af-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${spent ? "bg-af-amber" : "bg-af-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-af-muted">{t("plans.meter.resets")}</p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-af-border bg-af-amber/10 p-3">
          <AlertCircle className="mt-0.5 w-4 h-4 shrink-0 text-af-amber-ink" />
          <p className="text-[13px] text-af-ink-2">{error}</p>
        </div>
      )}

      {/*
        Collapsed by default. The chooser is a tall component and Settings is a
        page people open to change a phone number, not to be sold to.
      */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-5 text-sm font-semibold text-af-primary-deep hover:underline"
      >
        {open ? t("plans.panel.hide") : t("plans.panel.change")}
      </button>

      {open && (
        <div className="mt-5 border-t border-af-border pt-5">
          <PlanChooser
            mode="settings"
            current={plan}
            fieldCount={fieldCount}
            busyPlan={busyPlan}
            onChoose={choose}
          />
        </div>
      )}
    </Card>
  );
}
