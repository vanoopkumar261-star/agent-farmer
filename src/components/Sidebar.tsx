"use client";

import {
  LayoutDashboard,
  Sprout,
  ShoppingCart,
  MapPin,
  Sparkles,
  FileText,
  Landmark,
  Settings,
  Microscope,
  Plus,
  User,
  Leaf,
  Newspaper,
  Library,
  FlaskConical,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LanguageProvider";
import AddFarmButton from "@/components/dashboard/AddFarmButton";

const navGroups: {
  titleKey: string;
  items: {
    icon: any;
    labelKey: string;
    href: string;
    /**
     * Set for destinations outside the dashboard shell (the Jaivik Sathi
     * eLibrary). They get `?from=<current path>` appended so their back button
     * returns the farmer to the page they left, rather than to the public
     * Jaivik Sathi landing page.
     */
    carryFrom?: boolean;
  }[];
}[] = [
  {
    titleKey: "nav.overview",
    items: [
      { icon: LayoutDashboard, labelKey: "nav.dashboard", href: "/dashboard" },
      // Directly below Dashboard — the assistant is a core Agent Farmer feature.
      { icon: Sparkles, labelKey: "nav.assistant", href: "/dashboard/assistant" },
      { icon: Sprout, labelKey: "nav.crops", href: "/dashboard/crops" },
    ],
  },
  {
    titleKey: "nav.intelligence",
    items: [
      { icon: Microscope, labelKey: "nav.disease", href: "/dashboard/disease" },
      { icon: FlaskConical, labelKey: "nav.soilPh", href: "/dashboard/soil" },
      { icon: ShoppingCart, labelKey: "nav.market", href: "/dashboard/market" },
      { icon: Newspaper, labelKey: "nav.news", href: "/dashboard/news" },
      { icon: MapPin, labelKey: "nav.storeLocator", href: "/dashboard/store-locator" },
      { icon: Library, labelKey: "nav.library", href: "/jaivik-sathi/library", carryFrom: true },
    ],
  },
  {
    titleKey: "nav.manage",
    items: [
      { icon: FileText, labelKey: "nav.expenses", href: "/dashboard/expenses" },
      { icon: Landmark, labelKey: "nav.schemes", href: "/dashboard/schemes" },
      { icon: Settings, labelKey: "nav.settings", href: "/dashboard/settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();

  return (
    <aside
      className="hidden lg:flex w-[264px] shrink-0 min-h-screen bg-af-card border-r border-af-border flex-col justify-between py-7 px-4 sticky top-0"
    >
      <div className="flex flex-col gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-9 h-9 rounded-xl bg-af-primary flex items-center justify-center shadow-af-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
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

        {/* Navigation groups */}
        {/* Tour anchor is the nav list, not the <aside>: the aside is
            `sticky` and stretches to the full document height, so highlighting it
            would cut a hole taller than the viewport. */}
        <nav data-tour="sidebar" className="flex flex-col gap-6">
          {navGroups.map((group) => (
            <div key={group.titleKey} className="flex flex-col gap-1">
              <div className="px-3 mb-1 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
                {t(group.titleKey)}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() =>
                      router.push(
                        item.carryFrom
                          ? `${item.href}?from=${encodeURIComponent(pathname)}`
                          : item.href
                      )
                    }
                    aria-current={isActive ? "page" : undefined}
                    className={`group w-full flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-[12px] text-sm font-semibold transition-all duration-150 text-left relative
                      outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-af-card
                      ${
                        isActive
                          ? "bg-af-sage text-af-secondary"
                          : "text-af-ink-2 hover:bg-af-bg hover:text-af-ink"
                      }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-af-primary" />
                    )}
                    <item.icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        isActive ? "text-af-primary" : "text-af-muted group-hover:text-af-ink-2"
                      }`}
                    />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
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

        <div className="h-px bg-af-border w-full" />

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
