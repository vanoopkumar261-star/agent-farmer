"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Globe, ChevronDown, Check, Settings, LogOut } from "lucide-react";
import NotificationsMenu from "./NotificationsMenu";
import { useT } from "@/components/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/config";
import { supabase } from "@/lib/supabase";

const SEARCH_NAV: [RegExp, string][] = [
  [/crop|stage|harvest|field/i, "/dashboard/crops"],
  [/market|price|mandi|sell/i, "/dashboard/market"],
  [/disease|scan|leaf|pest|infect/i, "/dashboard/disease"],
  [/expense|money|income|profit|cost|ledger/i, "/dashboard/expenses"],
  [/scheme|subsidy|loan|govern|pm-?kisan/i, "/dashboard/schemes"],
  [/assistant|chat|ask|advice/i, "/dashboard/assistant"],
  [/store|shop|fertiliz|seed|locat|map/i, "/dashboard/store-locator"],
  [/setting|profile|language|account/i, "/dashboard/settings"],
];

export default function TopBar({ farmerName, farmerId }: { farmerName: string; farmerId?: string }) {
  const { t, locale, setLocale } = useT();
  const router = useRouter();
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [search, setSearch] = useState("");
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const runSearch = () => {
    const q = search.trim();
    if (!q) return;
    const match = SEARCH_NAV.find(([re]) => re.test(q));
    router.push(match ? match[1] : "/dashboard/assistant");
    setSearch("");
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = farmerName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    // v2: solid ivory instead of a translucent blurred pane. The frosted header
    // was the app's most visible glassmorphism cue, and over the photographic
    // page backdrops it smeared the image rather than reading as depth.
    <header className="sticky top-0 z-30 bg-af-bg border-b border-af-border">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-16">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-af-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={t("topbar.search")}
              className="w-full rounded-[12px] bg-af-card border border-af-border pl-10 pr-4 py-2.5 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* Language */}
        <div className="relative hidden sm:block" ref={langRef}>
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-af-border bg-af-card px-3 py-2 text-sm font-semibold text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 transition"
          >
            <Globe className="w-4 h-4" />
            {current.label}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-af-card border border-af-border shadow-af-float overflow-hidden z-50 py-1.5">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLocale(l.code);
                    setLangOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-af-ink-2 hover:bg-af-bg hover:text-af-ink transition"
                >
                  {l.label}
                  {l.code === locale && <Check className="w-4 h-4 text-af-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationsMenu farmerId={farmerId} />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="inline-flex items-center gap-2.5 rounded-[12px] border border-af-border bg-af-card pl-1.5 pr-3 py-1.5 hover:border-af-primary/30 transition"
          >
            <span className="w-8 h-8 rounded-full bg-af-primary text-white flex items-center justify-center text-xs font-semibold">
              {initials || "AF"}
            </span>
            <span className="hidden sm:block text-sm font-semibold text-af-ink max-w-[120px] truncate">
              {farmerName}
            </span>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-af-muted" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-af-card border border-af-border shadow-af-float overflow-hidden z-50 py-1.5">
              <Link
                href="/dashboard/settings"
                onClick={() => setProfileOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-af-ink-2 hover:bg-af-bg hover:text-af-ink transition"
              >
                <Settings className="w-4 h-4" />
                {t("nav.settings")}
              </Link>
              <button
                onClick={signOut}
                disabled={signingOut}
                // /8 is not on Tailwind's opacity scale, so the old class never
                // generated and Sign out had no hover state at all.
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-af-danger hover:bg-af-danger/10 transition disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? t("topBar.signingOut") : t("topBar.signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
