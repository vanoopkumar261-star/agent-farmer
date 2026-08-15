"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageProvider, useT } from "@/components/i18n/LanguageProvider";
import SiteHeader, { LeafMark } from "@/components/landing/SiteHeader";
import BootSplash from "@/components/landing/BootSplash";
import SmoothScroll from "@/components/SmoothScroll";

/* ────────────────────────────────────────────────────────────────────────────
   Agent Farmer — Home (Agent Farmer OS re-theme)
   Boot-splash terminal → light & airy landing. Emerald / forest / blue / slate
   palette · Plus Jakarta Sans + JetBrains Mono · gradient washes, dot-grid
   texture, glassy layers and soft glows for depth.
   ──────────────────────────────────────────────────────────────────────────── */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-of-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-of-primary shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      {children}
    </span>
  );
}

function SectionHead({ kicker, title, body, center = false }: { kicker: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={`${center ? "mx-auto max-w-[52ch] text-center" : "max-w-[62ch]"}`}>
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-5 font-sans text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] text-of-ink sm:text-[42px]">
        {title}
      </h2>
      {body && (
        <p className={`mt-5 font-sans text-[16px] font-normal leading-[1.6] text-of-body sm:text-[17px] ${center ? "mx-auto" : ""} max-w-[58ch]`}>
          {body}
        </p>
      )}
    </div>
  );
}

/* ── Hero ── */
function Hero({ onFarmer, onCompany }: { onFarmer: () => void; onCompany: () => void }) {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden">
      <div className="of-canvas absolute inset-0" />
      <div className="of-topo absolute inset-0 opacity-[0.6]" />
      <div className="relative mx-auto max-w-[1120px] px-6 pb-20 pt-16 text-center sm:pt-24">
        <div className="flex justify-center">
          <Kicker>Autonomous Farming OS</Kicker>
        </div>
        <h1 className="mx-auto mt-6 max-w-[18ch] font-sans text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] text-of-ink sm:text-[68px]">
          {t("l.hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-[56ch] font-sans text-[16px] font-normal leading-[1.6] text-of-body sm:text-[18px]">
          {t("a.hero.sub")}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onFarmer}
            className="of-grad-emerald rounded-full px-7 py-3 font-sans text-[14px] font-semibold text-white shadow-of-glow transition-transform hover:-translate-y-0.5"
          >
            {t("l.hero.farmer")}
          </button>
          <button
            onClick={onCompany}
            className="rounded-full border border-of-border bg-white/70 px-7 py-3 font-sans text-[14px] font-semibold text-of-ink backdrop-blur transition-colors hover:border-of-primary/50"
          >
            {t("l.hero.company")}
          </button>
        </div>

        <div className="relative mx-auto mt-16 max-w-[960px]">
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-of-primary/15 blur-3xl" />
          <div className="of-ring rounded-[28px] p-px shadow-of-float">
            <div className="overflow-hidden rounded-[27px] bg-of-surface">
              <video
                className="aspect-[16/9] w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster="/images/hero.png"
                aria-label="Aerial drone footage of farmland"
              >
                <source src="/videos/hero.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features (3 pillars) ── */
function IconChip({ path, tone }: { path: string; tone: "emerald" | "blue" | "forest" }) {
  const bg = tone === "blue" ? "bg-of-blue" : tone === "forest" ? "bg-of-forest" : "of-grad-emerald";
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${bg} shadow-of-glow`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden>
        <path d={path} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Features() {
  const { t } = useT();
  const cards = [
    { tone: "emerald" as const, title: t("l.about.c1t"), body: t("l.about.c1b"), path: "M12 3l7 4v5c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V7l7-4Z M9.5 12l1.8 1.8L15 10" },
    { tone: "blue" as const, title: t("l.about.c2t"), body: t("l.about.c2b"), path: "M4 5h16v10H8l-4 4V5Z M8 9h8M8 12h5" },
    { tone: "forest" as const, title: t("l.about.c3t"), body: t("l.about.c3b"), path: "M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z" },
  ];
  return (
    <section id="about" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1180px] px-6 py-24">
        <SectionHead kicker="What's inside" title={t("l.about.title")} body={t("l.about.body")} />
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group rounded-3xl border border-of-border bg-of-surface p-7 shadow-of-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-of-float"
            >
              <IconChip path={c.path} tone={c.tone} />
              <h3 className="mt-6 font-sans text-[19px] font-bold text-of-ink">{c.title}</h3>
              <p className="mt-2.5 font-sans text-[15px] font-normal leading-[1.6] text-of-body">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works (3 steps) ── */
function HowItWorks() {
  const { t } = useT();
  const steps = [
    { t: t("l.how.s1t"), b: t("l.how.s1b") },
    { t: t("l.how.s2t"), b: t("l.how.s2b") },
    { t: t("l.how.s3t"), b: t("l.how.s3b") },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-[1180px] px-6 py-24">
        <SectionHead kicker={t("l.how.kicker")} title={t("l.how.title")} center />
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-[calc(50%+40px)] top-7 hidden h-px w-[calc(100%-80px)] border-t border-dashed border-of-border md:block" />
              )}
              <div className="relative flex flex-col items-center text-center">
                <span className="of-grad-emerald flex h-14 w-14 items-center justify-center rounded-2xl font-sans text-[20px] font-extrabold text-white shadow-of-glow">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-sans text-[19px] font-bold text-of-ink">{s.t}</h3>
                <p className="mt-2 max-w-[32ch] font-sans text-[15px] font-normal leading-[1.6] text-of-body">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Capabilities (the whole toolset) ── */
function Capabilities() {
  const { t } = useT();
  const caps = [
    { t: t("a.feat.f1t"), b: t("a.feat.f1b") },
    { t: t("a.feat.f2t"), b: t("a.feat.f2b") },
    { t: t("a.feat.f3t"), b: t("a.feat.f3b") },
    { t: t("a.feat.f4t"), b: t("a.feat.f4b") },
    { t: t("a.feat.f5t"), b: t("a.feat.f5b") },
    { t: t("a.feat.f6t"), b: t("a.feat.f6b") },
  ];
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1180px] px-6 py-24">
        <SectionHead kicker={t("l.cap.kicker")} title={t("l.cap.title")} body={t("l.cap.body")} />
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {caps.map((c, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-of-border bg-of-surface p-6 shadow-of-card transition-all duration-300 hover:-translate-y-1 hover:border-of-primary/40 hover:shadow-of-float"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] font-medium tracking-[0.1em] text-of-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-of-border transition-colors group-hover:bg-of-primary" />
              </div>
              <h3 className="mt-4 font-sans text-[18px] font-bold text-of-ink">{c.t}</h3>
              <p className="mt-2 font-sans text-[14px] font-normal leading-[1.6] text-of-body">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats band ── */
function Stats() {
  const { t } = useT();
  const stats = [
    { n: t("a.ben.s1n"), c: t("a.ben.s1t") },
    { n: t("a.ben.s2n"), c: t("a.ben.s2t") },
    { n: t("a.ben.s3n"), c: t("a.ben.s3t") },
  ];
  return (
    <section className="relative">
      <div className="of-grad-emerald h-1.5 w-full opacity-80" />
      <div className="mx-auto max-w-[1180px] px-6 py-20">
        <Kicker>{t("a.ben.label")}</Kicker>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {stats.map((s, i) => (
            <div key={i} className="border-t border-of-border pt-6">
              <p className="of-grad-text font-sans text-[54px] font-extrabold leading-none tracking-[-0.03em] sm:text-[76px]">
                {s.n}
              </p>
              <p className="mt-4 max-w-[28ch] font-sans text-[14px] font-normal leading-[1.5] text-of-body">{s.c}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA band ── */
function CtaBand({ onDemo }: { onDemo: () => void }) {
  const { t } = useT();
  return (
    <section className="relative px-6 py-20">
      <div className="of-grad-emerald relative mx-auto max-w-[1180px] overflow-hidden rounded-[32px] px-8 py-16 text-center shadow-of-glow sm:px-12">
        <div className="of-grain pointer-events-none absolute inset-0 opacity-[0.08]" />
        <div className="relative">
          <h2 className="mx-auto max-w-[18ch] font-sans text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white sm:text-[44px]">
            {t("l.cta2.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-[50ch] font-sans text-[15px] font-normal leading-[1.6] text-white/85 sm:text-[17px]">
            {t("l.cta2.body")}
          </p>
          <button
            onClick={onDemo}
            className="mt-8 rounded-full bg-white px-8 py-3 font-sans text-[14px] font-semibold text-of-forest shadow-of-float transition-transform hover:-translate-y-0.5"
          >
            {t("l.cta2.btn")} →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  const { t } = useT();
  const cols = [
    { head: t("l.foot.product"), links: [t("l.cta.demo"), t("l.about.c1t"), t("l.about.c2t"), t("l.about.c3t")] },
    { head: t("l.foot.company"), links: [t("l.nav.about"), t("l.nav.team"), t("l.nav.arch")] },
    { head: t("l.foot.resources"), links: ["Docs", "Guides", "Support", "Status"] },
  ];
  return (
    <footer className="relative overflow-hidden bg-of-forest">
      <div className="of-grad-emerald pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" />
      <div className="of-grain pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-[1180px] px-6 pb-14 pt-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 text-white">
              <span className="of-grad-emerald flex h-8 w-8 items-center justify-center rounded-xl">
                <LeafMark className="h-4 w-4 text-white" />
              </span>
              <span className="font-sans text-[17px] font-bold tracking-tight">Agent Farmer</span>
            </div>
            <p className="mt-4 max-w-[26ch] font-sans text-[14px] font-normal leading-[1.6] text-white/60">
              {t("l.foot.tagline")}
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.head}>
              <h4 className="font-mono text-[12px] uppercase tracking-[0.12em] text-of-primary">{c.head}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="font-sans text-[14px] font-normal text-white/70 transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 border-t border-white/10 pt-6">
          <p className="font-sans text-[13px] font-normal text-white/50">
            © {new Date().getFullYear()} Agent Farmer. {t("l.foot.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function HomeContent() {
  const router = useRouter();
  // "I'm a Farmer" goes via the oilseed awareness page, which hands off to
  // registration. The demo CTA still opens onboarding directly.
  const goFarmer = () => router.push("/oilseeds");
  const goOnboarding = () => router.push("/onboarding");
  const goCompany = () => router.push("/jaivik-sathi");
  const [showBoot, setShowBoot] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("af_booted")) setShowBoot(false);
    } catch {}
  }, []);

  const endBoot = () => {
    try {
      sessionStorage.setItem("af_booted", "1");
    } catch {}
    setShowBoot(false);
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden font-sans">
      {/* ── Layered page background: continuous wash + topographic contours
             + slow drifting colour glows + grain, behind all content ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="of-canvas absolute inset-0" />
        <div className="of-topo absolute inset-0 opacity-70" />
        <div className="animate-af-drift absolute -left-40 top-[6%] h-[38rem] w-[38rem] rounded-full bg-of-primary/10 blur-[130px]" />
        <div className="animate-af-drift-2 absolute -right-48 top-[40%] h-[42rem] w-[42rem] rounded-full bg-of-blue/[0.08] blur-[140px]" />
        <div className="animate-af-drift absolute -left-32 bottom-[4%] h-[36rem] w-[36rem] rounded-full bg-of-forest/[0.09] blur-[130px]" />
        <div className="of-grain absolute inset-0 opacity-[0.05]" />
      </div>

      {showBoot && <BootSplash onDone={endBoot} />}
      <SiteHeader />
      <Hero onFarmer={goFarmer} onCompany={goCompany} />
      <Features />
      <HowItWorks />
      <Capabilities />
      <Stats />
      <CtaBand onDemo={goOnboarding} />
      <Footer />
    </main>
  );
}

export default function Home() {
  return (
    <SmoothScroll>
      <LanguageProvider>
        <HomeContent />
      </LanguageProvider>
    </SmoothScroll>
  );
}
