"use client";

import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LanguageProvider";
import { Lock } from "lucide-react";
import { navGroups } from "./navGroups";
import { atLeast, type PlanId } from "@/lib/plans";

/**
 * The navigation itself — rendered by the desktop rail and the mobile drawer.
 *
 * Shared so the two cannot disagree about what exists. `onNavigate` lets the
 * drawer close itself on tap; the rail passes nothing.
 *
 * Labels are deliberately not truncated. `nav.disease` is "Disease Detection"
 * in English and runs longer in most of the other eight languages, so a label
 * that wraps to two lines is correct and a clipped one is not.
 */
export default function NavList({
  onNavigate,
  plan = "free",
}: {
  onNavigate?: () => void;
  plan?: PlanId;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  return (
    <nav data-tour="sidebar" className="flex flex-col gap-6">
      {navGroups.map((group) => (
        <div key={group.titleKey} className="flex flex-col gap-1">
          <div className="px-3 mb-1 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
            {t(group.titleKey)}
          </div>
          {group.items.map((item) => {
            const isActive = pathname === item.href;
            // Still navigable. The destination explains what the tier includes,
            // which is more use to a farmer than a nav item that does nothing.
            const locked = !!item.minPlan && !atLeast(plan, item.minPlan);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(
                    item.carryFrom
                      ? `${item.href}?from=${encodeURIComponent(pathname)}`
                      : item.href
                  );
                  onNavigate?.();
                }}
                aria-current={isActive ? "page" : undefined}
                className={`group w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-[12px] text-sm font-semibold transition-all duration-150 text-left relative
                  outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-af-card
                  ${
                    isActive
                      ? "af-nav-active text-af-secondary"
                      : "text-af-ink-2 hover:bg-af-bg hover:text-af-ink"
                  }`}
              >
                {isActive && (
                  <span className="af-nav-marker absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full" />
                )}
                <item.icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? "text-af-primary" : "text-af-muted group-hover:text-af-ink-2"
                  }`}
                />
                {t(item.labelKey)}
                {locked && (
                  <Lock className="ml-auto w-3.5 h-3.5 shrink-0 text-af-muted" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
