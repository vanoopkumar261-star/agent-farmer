"use client";

import React, { useState } from "react";
import { LanguageProvider, useT } from "@/components/i18n/LanguageProvider";
import { LeafMark, LanguageMenu } from "@/components/landing/SiteHeader";

/* ────────────────────────────────────────────────────────────────────────────
   Agent Farmer — About page (Agent Farmer OS re-theme)
   Editorial LUMOSINE structure, restyled to the modern light system: airy canvas
   with gradient washes + dot texture, Plus Jakarta + JetBrains Mono, emerald /
   forest / blue accents, glassy layers, forest-gradient bands for depth.
   No top bar (per request) — nav + language live in the footer.
   ──────────────────────────────────────────────────────────────────────────── */

function Molecule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 460" className={className} fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="26" strokeLinecap="round">
        <path d="M300 430 L300 210" />
        <path d="M300 300 L150 180" />
        <path d="M300 300 L450 180" />
      </g>
      <g fill="currentColor">
        <circle cx="300" cy="150" r="80" />
        <circle cx="140" cy="150" r="62" />
        <circle cx="460" cy="150" r="62" />
      </g>
    </svg>
  );
}

const KICKER = "font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-of-primary";

/* 1 — Hero with inline drone-video circle */
function Hero() {
  const { t } = useT();
  return (
    <section className="relative flex min-h-[86vh] flex-col justify-between overflow-hidden px-6 pb-8 pt-14 sm:px-12">
      <div className="of-canvas absolute inset-0" />
      <div className="of-dotgrid absolute inset-0 opacity-[0.5]" />
      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="flex max-w-[16ch] flex-wrap items-center justify-center gap-x-4 gap-y-1 font-sans text-[40px] font-extrabold leading-[1.02] tracking-[-0.03em] text-of-ink sm:text-[70px]">
          <span>{t("a.hero.hello")}</span>
          <span className="of-ring inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full p-[2px] align-middle shadow-of-glow sm:h-[70px] sm:w-[70px]">
            <span className="h-full w-full overflow-hidden rounded-full">
              <video className="h-full w-full object-cover" autoPlay muted loop playsInline poster="/images/hero.png" aria-hidden>
                <source src="/videos/hero.mp4" type="video/mp4" />
              </video>
            </span>
          </span>
          <span className="of-grad-text">Agent Farmer</span>
        </h1>
        <p className="mt-8 max-w-[54ch] font-sans text-[15px] font-normal leading-[1.6] text-of-body sm:text-[18px]">
          {t("a.hero.sub")}
        </p>
      </div>
      <div className="relative mt-10 flex items-center justify-between">
        <span className={KICKER}>{t("a.kicker")}</span>
        <span className="flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-of-muted">
          {t("a.hero.scroll")}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-af-float" fill="none" aria-hidden>
            <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </section>
  );
}

/* 2 — Motive manifesto */
function Motive() {
  const { t } = useT();
  return (
    <section className="bg-of-bg px-6 py-24 sm:px-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex justify-end">
          <span className={KICKER}>{t("a.motive.label")}</span>
        </div>
        <h2 className="max-w-[22ch] font-sans text-[32px] font-extrabold leading-[1.08] tracking-[-0.025em] text-of-ink sm:text-[54px]">
          {t("a.motive.title")}
        </h2>
        <div className="of-grad-emerald mt-10 h-px w-full opacity-40" />
      </div>
    </section>
  );
}

/* 3 — Goal + team band (forest-gradient interstitial) */
function Goal() {
  const { t } = useT();
  return (
    <section className="bg-of-bg px-6 pb-24 sm:px-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="of-ring rounded-[28px] p-px shadow-of-float">
          <div className="overflow-hidden rounded-[27px]">
            <img
              src="/team/team-group.png"
              alt="The Agent Farmer team"
              className="h-[40vh] w-full object-cover object-[center_28%] grayscale sm:h-[50vh]"
            />
            <div className="relative overflow-hidden bg-of-forest px-6 py-14 sm:px-12">
              <div className="of-grain pointer-events-none absolute inset-0 opacity-[0.06]" />
              <div className="relative">
                <span className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-of-primary">
                  {t("a.goal.label")}
                </span>
                <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                  <p className="font-sans text-[24px] font-bold leading-[1.15] tracking-[-0.01em] text-white sm:text-[32px]">
                    {t("a.goal.lead")}
                  </p>
                  <div>
                    <p className="max-w-[52ch] font-sans text-[15px] font-normal leading-[1.7] text-white/75 sm:text-[16px]">
                      {t("a.goal.body")}
                    </p>
                    <a
                      href="/onboarding"
                      className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-sans text-[13px] font-semibold text-of-primary ring-1 ring-of-primary/40 transition-colors hover:bg-white/15"
                    >
                      {t("a.goal.cta")} →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 4 — Benefits stats */
function Benefits() {
  const { t } = useT();
  const stats = [
    { n: t("a.ben.s1n"), c: t("a.ben.s1t") },
    { n: t("a.ben.s2n"), c: t("a.ben.s2t") },
    { n: t("a.ben.s3n"), c: t("a.ben.s3t") },
  ];
  return (
    <section className="bg-of-bg-2">
      <div className="of-grad-emerald h-2.5 w-full" />
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
          <span className={KICKER}>{t("a.ben.label")}</span>
          <div>
            <p className="max-w-[40ch] font-sans text-[18px] font-normal leading-[1.6] text-of-ink sm:text-[20px]">
              {t("a.ben.lead")}
            </p>
            <a
              href="#features"
              className="of-grad-emerald mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-sans text-[13px] font-semibold text-white shadow-of-glow transition-transform hover:-translate-y-0.5"
            >
              {t("a.ben.cta")} ↘
            </a>
          </div>
        </div>
        <div className="mt-16 border-t border-of-border pt-12">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {stats.map((s, i) => (
              <div key={i}>
                <p className="of-grad-text font-sans text-[56px] font-extrabold leading-none tracking-[-0.03em] sm:text-[80px]">
                  {s.n}
                </p>
                <p className="mt-4 max-w-[28ch] font-sans text-[14px] font-normal leading-[1.5] text-of-body">{s.c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* 5 — Features accordion */
function Features() {
  const { t } = useT();
  const items = [
    { t: t("a.feat.f1t"), b: t("a.feat.f1b") },
    { t: t("a.feat.f2t"), b: t("a.feat.f2b") },
    { t: t("a.feat.f3t"), b: t("a.feat.f3b") },
    { t: t("a.feat.f4t"), b: t("a.feat.f4b") },
    { t: t("a.feat.f5t"), b: t("a.feat.f5b") },
    { t: t("a.feat.f6t"), b: t("a.feat.f6b") },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="features" className="scroll-mt-6 bg-of-bg px-6 py-20 sm:px-12">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 md:grid-cols-[1fr_2fr]">
        <div>
          <span className={KICKER}>{t("a.feat.label")}</span>
          <h2 className="mt-4 font-sans text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-of-ink sm:text-[44px]">
            {t("a.feat.title")}
          </h2>
        </div>
        <div>
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-t border-of-border last:border-b">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="font-sans text-[16px] font-semibold text-of-ink sm:text-[18px]">{it.t}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[18px] transition-colors ${isOpen ? "of-grad-emerald text-white" : "bg-of-bg-2 text-of-primary"}`}>
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                <div className="grid overflow-hidden transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                  <div className="min-h-0">
                    <p className="max-w-[54ch] pb-5 font-sans text-[14px] font-normal leading-[1.6] text-of-body sm:text-[15px]">
                      {it.b}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* 6 — Future roadmap */
function Future() {
  const { t } = useT();
  const items = [
    { t: t("a.fut.u1t"), b: t("a.fut.u1b") },
    { t: t("a.fut.u2t"), b: t("a.fut.u2b") },
    { t: t("a.fut.u3t"), b: t("a.fut.u3b") },
    { t: t("a.fut.u4t"), b: t("a.fut.u4b") },
  ];
  return (
    <section className="relative overflow-hidden bg-of-bg-2 px-6 py-24 sm:px-12">
      <Molecule className="pointer-events-none absolute -bottom-16 left-1/2 h-[420px] w-[420px] -translate-x-1/2 text-of-forest/[0.06]" />
      <div className="relative mx-auto max-w-[1180px]">
        <span className={KICKER}>{t("a.fut.label")}</span>
        <h2 className="mt-4 max-w-[16ch] font-sans text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-of-ink sm:text-[44px]">
          {t("a.fut.title")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-3xl border border-of-border bg-of-surface p-6 shadow-of-card transition-all duration-300 hover:-translate-y-1 hover:shadow-of-float">
              <div className="flex items-center gap-3">
                <h3 className="font-sans text-[17px] font-bold text-of-ink">{it.t}</h3>
                <span className="of-grad-emerald rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-white">
                  {t("a.fut.tag")}
                </span>
              </div>
              <p className="mt-2 max-w-[46ch] font-sans text-[14px] font-normal leading-[1.6] text-of-body">{it.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 7 — Footer */
function SocialIcon({ d }: { d: string }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-of-primary hover:text-white">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  );
}

function Footer() {
  const { t } = useT();
  const nav = [
    { label: t("a.foot.home"), href: "/" },
    { label: t("l.nav.team"), href: "/team" },
    { label: t("l.nav.arch"), href: "/architecture" },
    { label: t("l.cta.demo"), href: "/onboarding" },
  ];
  return (
    <footer className="relative overflow-hidden bg-of-forest px-6 pb-10 pt-16 sm:px-12">
      <div className="of-grad-emerald pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" />
      <Molecule className="pointer-events-none absolute -top-24 left-1/2 h-[360px] w-[360px] -translate-x-1/2 text-white/[0.04]" />
      <div className="relative mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-2.5 text-white">
            <span className="of-grad-emerald flex h-8 w-8 items-center justify-center rounded-xl">
              <LeafMark className="h-4 w-4 text-white" />
            </span>
            <span className="font-sans text-[18px] font-bold tracking-tight">Agent Farmer</span>
          </a>
          <nav className="flex flex-wrap items-center gap-6">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/80 transition-colors hover:text-of-primary"
              >
                {n.label}
              </a>
            ))}
            <LanguageMenu tone="dark" />
          </nav>
        </div>

        <div className="flex flex-col items-center gap-6 py-16 text-center">
          <a
            href="mailto:hello@agentfarmer.app"
            className="font-sans text-[34px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-of-primary sm:text-[56px]"
          >
            {t("a.foot.contact")}
          </a>
          <div className="flex items-center gap-3">
            <SocialIcon d="M13 10h3l1-4h-4V4c0-1 .3-2 2-2h2V-.5C18.7-.7 17.4-1 16-1c-3 0-5 1.8-5 5.2V6H8v4h3v11h2z" />
            <SocialIcon d="M12 7.4A4.6 4.6 0 1012 16.6 4.6 4.6 0 0012 7.4zm0 7.6a3 3 0 110-6 3 3 0 010 6zm4.8-7.8a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0zM20 8c-.1-1.3-.4-2.5-1.4-3.5S16.4 3.1 15 3c-1.4-.1-5.6-.1-7 0-1.3.1-2.5.4-3.5 1.4S3.1 6.6 3 8c-.1 1.4-.1 5.6 0 7 .1 1.3.4 2.5 1.4 3.5S6.6 20.9 8 21c1.4.1 5.6.1 7 0 1.3-.1 2.5-.4 3.5-1.4S20.9 17.4 21 16c.1-1.4.1-5.6 0-7z" />
            <SocialIcon d="M6.9 8H4V21h2.9V8zM5.4 3.5A1.7 1.7 0 105.4 7a1.7 1.7 0 000-3.5zM21 21h-2.9v-6.4c0-1.6-.6-2.6-2-2.6-1.1 0-1.7.7-2 1.5-.1.2-.1.6-.1.9V21H11s.04-11 0-13h2.9v1.8c.4-.6 1.1-1.5 2.7-1.5 2 0 3.5 1.3 3.5 4.1V21z" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="font-sans text-[12px] font-normal text-white/50">
            © {new Date().getFullYear()} Agent Farmer. {t("l.foot.rights")}
          </p>
          <p className="font-sans text-[12px] font-normal text-white/50">{t("a.foot.built")}</p>
        </div>
      </div>
    </footer>
  );
}

function AboutContent() {
  return (
    <main className="min-h-screen bg-of-bg font-sans">
      <Hero />
      <section className="bg-of-bg px-6 pb-4 pt-4 sm:px-12">
        <div className="mx-auto max-w-[1180px]">
          <div className="of-ring rounded-[28px] p-px shadow-of-float">
            <img
              src="/images/hero.png"
              alt="Aerial view of regenerative farmland"
              className="h-[44vh] w-full rounded-[27px] object-cover sm:h-[56vh]"
            />
          </div>
        </div>
      </section>
      <Motive />
      <Goal />
      <Benefits />
      <Features />
      <Future />
      <Footer />
    </main>
  );
}

export default function AboutPage() {
  return (
    <LanguageProvider>
      <AboutContent />
    </LanguageProvider>
  );
}
