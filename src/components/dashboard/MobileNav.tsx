"use client";

/**
 * The dashboard's navigation on a phone.
 *
 * Until this existed there was none. `Sidebar` is `hidden lg:flex`, and the
 * header offered only a search box that guesses a route from a regex. Below
 * 1024px every one of the thirteen dashboard pages — market prices, irrigation,
 * disease, schemes — was effectively unreachable unless the farmer guessed a
 * keyword. For an app whose users are overwhelmingly on phones, that was the
 * single worst thing about the interface.
 *
 * The language switcher lives in here too, not just in the header. The header
 * copy is `hidden sm:block`, so on a 360px screen the control for choosing
 * between nine languages had disappeared entirely — in an app whose whole
 * premise is speaking the farmer's language. There is no room for a ninth
 * control in a 360px header bar, and the drawer is where it belongs anyway.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Plus, Check, Globe } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { LOCALES } from "@/lib/i18n/config";
import AddFarmButton from "./AddFarmButton";
import NavList from "./NavList";
import type { PlanId } from "@/lib/plans";

export default function MobileNav({ plan = "free" }: { plan?: PlanId }) {
  const { t, locale, setLocale } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation. `NavList` also calls `onNavigate`, but a farmer can
  // leave via the Add-farm button or the browser's own back gesture, and a
  // drawer still sitting open over the new page is worse than not having one.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the drawer scrolling under the farmer's thumb.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("nav.openMenu")}
        aria-expanded={open}
        className="lg:hidden inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-[12px] border border-af-border bg-af-card text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="relative flex h-full w-[86%] max-w-[300px] flex-col gap-6 overflow-y-auto bg-af-card border-r border-af-border px-4 py-6 shadow-af-float"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/images/logo_circle.png"
                  alt=""
                  aria-hidden="true"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover shadow-af-sm shrink-0"
                />
                <span className="font-sans font-semibold text-[15px] text-af-ink tracking-[-0.02em] leading-none truncate">
                  Agent Farmer
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-[10px] text-af-muted hover:text-af-ink hover:bg-af-bg transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <NavList onNavigate={() => setOpen(false)} plan={plan} />

            <div className="mt-auto flex flex-col gap-4 pt-2">
              <AddFarmButton
                variant="custom"
                className="w-full flex items-center justify-center gap-2 bg-af-primary hover:bg-af-primary-deep text-af-on-primary py-2.5 rounded-[12px] text-sm font-semibold tracking-[-0.01em] transition-all duration-150 active:scale-[0.99] shadow-af-sm"
              >
                <Plus className="w-4 h-4" />
                {t("nav.newFarm")}
              </AddFarmButton>

              <div aria-hidden="true" className="af-rule-warm h-px w-full" />

              {/* Appearance. Sits with language because both are "how the app
                  presents itself to me", not farm data. */}
              <div className="flex items-center justify-between px-1">
                <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                  {t("theme.title")}
                </span>
                <ThemeToggle />
              </div>

              <div aria-hidden="true" className="af-rule-warm h-px w-full" />

              <div>
                <div className="px-1 mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                  <Globe className="w-3.5 h-3.5" />
                  {t("nav.language")}
                </div>
                <div className="flex flex-col">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLocale(l.code)}
                      aria-current={l.code === locale ? "true" : undefined}
                      className="w-full flex items-center justify-between rounded-[10px] px-3 py-2 text-sm font-semibold text-af-ink-2 hover:bg-af-bg hover:text-af-ink transition outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50"
                    >
                      {l.label}
                      {l.code === locale && <Check className="w-4 h-4 text-af-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
