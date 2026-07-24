"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/config";

/* Shared floating glass nav for the Agent Farmer OS re-theme (Home + Team).
   Sleek pill with a gradient hairline, backdrop blur, emerald CTA. */

export function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 21c0-6 3-11 9-13-1 8-4 12-9 13Z M12 21C7 20 4 16 3 8c6 2 9 7 9 13Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* Language selector — `tone` adapts it to a light (glass nav) or dark (footer) surface. */
export function LanguageMenu({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];
  const trigger =
    tone === "light"
      ? "text-of-body hover:text-of-primary"
      : "text-pure-white/90 hover:text-of-primary";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors ${trigger}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        {current.label}
        <Chevron className="h-2.5 w-2.5" />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            className="absolute right-0 z-50 mt-3 max-h-[320px] w-52 overflow-auto rounded-2xl border border-of-border bg-of-surface py-2 shadow-of-float"
          >
            {LOCALES.map((l) => {
              const active = l.code === locale;
              return (
                <li key={l.code}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setLocale(l.code);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left font-sans text-[14px] transition-colors hover:bg-of-bg-2 ${
                      active ? "font-semibold text-of-primary" : "font-normal text-of-ink"
                    }`}
                  >
                    <span>{l.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-of-muted">{l.aiName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const { t } = useT();
  const router = useRouter();
  const nav = [
    { label: t("l.nav.about"), href: "/about" },
    { label: t("l.nav.team"), href: "/team" },
    { label: t("l.nav.arch"), href: "/architecture" },
  ];
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto max-w-[1220px] px-4 pt-4">
        {/* gradient hairline ring */}
        <div className="of-ring rounded-[20px] p-px shadow-of-nav">
          <div className="flex h-[58px] items-center justify-between rounded-[19px] bg-white/70 px-3 pl-4 backdrop-blur-xl sm:px-4">
            {/* logo */}
            <a href="/" className="flex items-center gap-2.5">
              <span className="of-grad-emerald flex h-8 w-8 items-center justify-center rounded-xl shadow-of-glow">
                <LeafMark className="h-4 w-4 text-white" />
              </span>
              <span className="font-sans text-[17px] font-bold tracking-tight text-of-ink">Agent Farmer</span>
            </a>

            {/* nav links */}
            <nav className="hidden items-center gap-8 md:flex">
              {nav.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="font-mono text-[12px] uppercase tracking-[0.1em] text-of-body transition-colors hover:text-of-primary"
                >
                  {n.label}
                </a>
              ))}
            </nav>

            {/* CTA + language */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:block">
                <LanguageMenu tone="light" />
              </div>
              <button
                onClick={() => router.push("/onboarding")}
                className="of-grad-emerald rounded-full px-5 py-2 font-sans text-[13px] font-semibold text-white shadow-of-glow transition-transform hover:-translate-y-0.5"
              >
                {t("l.cta.demo")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
