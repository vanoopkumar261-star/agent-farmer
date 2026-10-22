import Link from "next/link";
import { Lock, ArrowRight, Check } from "lucide-react";
import { T } from "@/components/i18n/LanguageProvider";
import { PLANS, type FeatureKey, type PlanId } from "@/lib/plans";

/**
 * What a farmer sees instead of a feature their plan does not include.
 *
 * Deliberately not a redirect. Someone who taps "Irrigation" wants to know
 * what irrigation does; bouncing them to Settings answers a question they did
 * not ask and teaches them nothing about what they would be buying. So the
 * page explains the feature, names the tier, and offers one link.
 *
 * A server component: it renders from the plan already loaded by the page, so
 * nothing about the lock depends on client state that could be edited.
 */
export default function PlanLocked({
  currentPlan,
  requiredPlan,
  featureKey,
  titleKey,
  bodyKey,
}: {
  currentPlan: PlanId;
  requiredPlan: PlanId;
  /** Drives the "what you get" list, read from the tier that includes it. */
  featureKey: FeatureKey;
  titleKey: string;
  bodyKey: string;
}) {
  const required = PLANS[requiredPlan];
  const highlights = required.features.filter((f) => f.onCard).slice(0, 5);

  return (
    <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-af-border bg-af-card p-8 text-center shadow-af-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-af-sage text-af-secondary">
        <Lock className="h-5 w-5" />
      </div>

      <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-af-ink">
        <T k={titleKey} />
      </h2>
      <p className="mt-2 text-sm text-af-ink-2">
        <T k={bodyKey} />
      </p>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-af-muted">
        <T k={required.nameKey} />
      </p>

      <ul className="mt-3 space-y-2 text-left inline-block">
        {highlights.map((f) => (
          <li key={f.key} className="flex items-start gap-2 text-[13px] text-af-ink-2">
            <Check
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                f.key === featureKey ? "text-af-primary" : "text-af-muted"
              }`}
            />
            <span className={f.key === featureKey ? "font-semibold text-af-ink" : ""}>
              <T k={f.labelKey} />
              {typeof f.value === "string" && (
                <span className="text-af-ink font-medium">
                  {" · "}
                  <T k={f.value} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/settings"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary px-6 py-3 text-sm font-semibold text-af-on-primary transition hover:bg-af-primary-deep"
      >
        <T k="plans.locked.cta" />
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="mt-3 text-[11px] text-af-muted">
        <T k="plans.disclaimer" />
      </p>

      {/* Stated so the current tier is never a guess. */}
      <p className="sr-only">{currentPlan}</p>
    </div>
  );
}
