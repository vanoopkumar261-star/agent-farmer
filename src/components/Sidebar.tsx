"use client";

import { Plus, User } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import AddFarmButton from "@/components/dashboard/AddFarmButton";
import NavList from "@/components/dashboard/NavList";

export default function Sidebar() {
  const { t } = useT();

  return (
    <aside
      className="af-sidebar relative hidden lg:flex w-[264px] shrink-0 min-h-screen flex-col justify-between py-7 px-4 sticky top-0"
    >
      {/* The right edge. A positioned element rather than `border-r`, because a
          border cannot hold a gradient — and a flat hairline beside a warm
          panel is the thing that made this read as a white box. */}
      <span aria-hidden="true" className="af-sidebar-edge absolute inset-y-0 right-0 w-px" />

      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2">
          {/* The mark carries its own dark-green disc, so there is no
              `bg-af-primary` behind it. The PNG is RGBA with transparent
              corners; `rounded-full` is belt-and-braces against any edge fringe
              and keeps the shape right if the file is ever swapped for a JPEG.
              `alt=""` + `aria-hidden` because the wordmark beside it already
              names the product — a screen reader should not hear it twice. */}
          <img
            src="/images/logo_circle.png"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover shadow-af-sm shrink-0"
          />
          <div>
            <span className="font-sans font-semibold text-[15px] text-af-ink tracking-[-0.02em] leading-none block">
              Agent Farmer
            </span>
            {/* Sidebar chrome runs one step tighter than the 11px `text-label`
                token used on cards — at 11px this sits too close to the 15px
                wordmark above it to read as a subtitle. */}
            <span className="font-mono text-[10px] tracking-[0.16em] text-af-primary/70 uppercase">
              AI Farm OS
            </span>
          </div>
        </div>

        {/* Gold inlay under the wordmark, brightest in the middle. */}
        <div aria-hidden="true" className="af-rule-warm h-px -mt-4 mx-2" />

        {/* Navigation groups — shared with the mobile drawer (NavList). */}
        <NavList />
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-4">
        {/* This used to push to /onboarding, which re-asked a signed-in farmer
            for their name, phone and house pin before letting them add a field. */}
        <AddFarmButton
          variant="custom"
          className="w-full flex items-center justify-center gap-2 bg-af-primary hover:bg-af-primary-deep text-white py-2.5 rounded-[12px] text-sm font-semibold tracking-[-0.01em] transition-all duration-150 active:scale-[0.99] shadow-af-sm"
        >
          <Plus className="w-4 h-4" />
          {t("nav.newFarm")}
        </AddFarmButton>

        <div aria-hidden="true" className="af-rule-warm h-px w-full" />

        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-9 h-9 rounded-full bg-af-sage flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-af-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-meta font-semibold text-af-ink truncate">{t("nav.farmerProfile")}</p>
            <p className="font-mono text-[9px] text-af-muted tracking-wide truncate">Agent Farmer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
