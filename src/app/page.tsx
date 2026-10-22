"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { LanguageProvider, useT } from "@/components/i18n/LanguageProvider";
import SiteHeader, { LeafMark } from "@/components/landing/SiteHeader";
import StarBorder from "@/components/landing/StarBorder";
import SmoothScroll from "@/components/SmoothScroll";
import { useTheme } from "@/components/theme/ThemeProvider";
import FindUs from "@/components/landing/FindUs";
import { TermsModal, PrivacyModal } from "@/components/legal/LegalModals";

/* ────────────────────────────────────────────────────────────────────────────
   Agent Farmer — Home, in the Arva pastoral-editorial layout.

   Structure follows the reference: a full-viewport video hero, then bands
   alternating between the bone canvas, quilted pastel tiles and solid forest
   interstitials, closing on the find-us band and a forest footer. Depth comes
   from surface colour shifts, never shadows.

   Three deliberate departures from the Arva spec:
   · The nav is the shared SiteHeader, the same one /team and /architecture use,
     rather than the reference's solid forest bar under a lime marquee. One
     header across the site beats a bespoke one on the home page.
   · Typography stays Inter. Arva pairs a Reckless serif with Inter, but the
     brief was to keep our type. Display sizes therefore lean on weight 200-300
     and tight tracking to carry the editorial tone instead of a serif.
   · Every string still comes from the i18n dictionaries, so all nine languages
     keep working — the layout changed, the content did not.

   Tokens (forest-ink, bone, vivid-lime, the pastel tiles, arva-* radii) already
   existed in tailwind.config.ts from this site's earlier Arva era.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── Full-bleed video hero ────────────────────────────────────────────────── */
function Hero() {
  const { t } = useT();
  const { theme } = useTheme();
  const dark = theme === "dark";

  /*
    Two clips, one per theme. The dark one is golden-hour drone footage over a
    harvested field, cut to a 15s loop from the 58s master and dimmed in CSS
    rather than in the file — so the grade stays tunable without a re-encode.
    The master itself is 4K60 at 250MB and is gitignored; see .gitignore.
  */
  const src = dark ? "/videos/hero-dark.mp4" : "/videos/hero.mp4";
  const srcMobile = dark ? "/videos/hero-dark-720.mp4" : "/videos/hero.mp4";
  const poster = dark ? "/images/hero-dark.webp" : "/images/hero.png";

  // A 15s loop is the loudest thing on the page. Everything else in the app
  // (AppBackground, SpotlightLayer, ReflectiveCard) stands down under
  // reduced-motion, so this does too — the poster still carries the image.
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  // 76px is SiteHeader's block height (pt-4 + its 58px pill + the 1px ring
  // either side). It is sticky rather than fixed, so it occupies layout space
  // above the hero; subtracting it keeps the hero exactly one viewport tall
  // instead of overflowing by the height of the nav.
  return (
    <section className="relative h-[calc(100vh-76px)] min-h-[560px] w-full overflow-hidden">
      {/* key={src} matters: swapping a <source> on a playing <video> does
          nothing on its own, so the element is remounted when the theme
          changes. brightness is applied here rather than baked into the file
          so the grade can be retuned without a re-encode. */}
      <video
        key={src}
        className="absolute inset-0 h-full w-full object-cover dark:[filter:brightness(0.62)saturate(0.9)]"
        autoPlay={!still}
        muted
        loop
        playsInline
        poster={poster}
        aria-label="Aerial drone footage of farmland"
      >
        {!still && (
          <>
            <source src={srcMobile} type="video/mp4" media="(max-width: 640px)" />
            <source src={src} type="video/mp4" />
          </>
        )}
      </video>

      {/* Arva runs no overlay box, but our headline is longer than theirs and the
          footage is bright — a soft vertical scrim keeps it legible without
          turning into a panel. */}
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal/35 via-charcoal/15 to-charcoal/45 dark:from-black/45 dark:via-black/25 dark:to-black/70" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-[20ch] font-sans text-[38px] font-extralight leading-[1.06] tracking-[-0.03em] text-white sm:text-[57px]">
          {t("l.hero.title")}
        </h1>
        <p className="mt-6 max-w-[54ch] font-sans text-[16px] font-light leading-[1.6] text-white/85 sm:text-[17px]">
          {t("a.hero.sub")}
        </p>

        {/*
          The two hero buttons carry a star tracing their border.

          Both are pills, so `radius` is the `arva-btn` token (100px) rather
          than StarBorder's 12px default — the component clamps it to half the
          height and walks the resulting outline by arc length, so the star
          holds one pace all the way round.

          Padding and type come through `style` and `className` rather than the
          component's own stylesheet: `.star-border` sets its own padding at the
          same specificity as a Tailwind utility, and which one wins depends on
          the order Next.js happens to emit the two stylesheets in. An inline
          style has no such argument.
        */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {/*
            Sign in, not the oilseed awareness page. This button says "I'm a
            farmer", and the thing a farmer wants behind it is their own
            dashboard — the awareness page is a step inside onboarding, not a
            front door.
          */}
          <StarBorder
            as={Link}
            href="/login"
            className="font-sans text-[14px] font-semibold uppercase tracking-[0.025em]"
            style={{ padding: "12px 28px" }}
            radius={100}
            backgroundColor="#07503f"
            textColor="#ffffff"
            borderColor="rgba(255, 255, 255, 0.28)"
            color="#ffffff"
            trailColor="#ffffff"
            duration={4}
            direction="clockwise"
            stars={1}
            trailLength={0.3}
            thickness={1}
            glow={0.6}
            hover="lap"
            sparkle={false}
            clickPulse
            theme="dark"
          >
            {t("l.hero.farmer")}
          </StarBorder>
          {/*
            The outlined twin. `backgroundColor` is transparent so the drone
            footage still shows through it, and the resting border is the same
            white it always was — the star now travels that line.
          */}
          <StarBorder
            as={Link}
            href="/jaivik-sathi"
            className="font-sans text-[14px] font-semibold uppercase tracking-[0.025em]"
            style={{ padding: "12px 28px" }}
            radius={100}
            backgroundColor="transparent"
            textColor="#ffffff"
            borderColor="rgba(255, 255, 255, 0.7)"
            color="#ffffff"
            trailColor="#ffffff"
            duration={4}
            direction="clockwise"
            stars={1}
            trailLength={0.3}
            thickness={1}
            glow={0.6}
            hover="lap"
            sparkle={false}
            clickPulse
            theme="dark"
          >
            {t("l.hero.company")}
          </StarBorder>
        </div>

        <a
          href="#about"
          className="absolute bottom-8 flex items-center gap-2 font-sans text-[13px] text-white/80 transition-colors hover:text-white"
        >
          {t("l.hero.scroll")}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  );
}

/* ── Section title block ──────────────────────────────────────────────────── */
function SectionHead({
  title,
  body,
  center = false,
  tone = "dark",
}: {
  title: string;
  body?: string;
  center?: boolean;
  tone?: "dark" | "light";
}) {
  const head = tone === "light" ? "text-white" : "text-charcoal";
  const sub = tone === "light" ? "text-white/80" : "text-graphite";
  return (
    <div className={center ? "mx-auto max-w-[52ch] text-center" : "max-w-[62ch]"}>
      <h2 className={`font-sans text-[32px] font-light leading-[1.06] tracking-[-0.022em] sm:text-[45px] ${head}`}>
        {title}
      </h2>
      {body && (
        <p className={`mt-5 max-w-[58ch] font-sans text-[16px] font-light leading-[1.6] sm:text-[17px] ${sub} ${center ? "mx-auto" : ""}`}>
          {body}
        </p>
      )}
    </div>
  );
}

/* ── Quilted pastel tiles ─────────────────────────────────────────────────── */
function Quilt() {
  const { t } = useT();
  const cards = [
    { surface: "bg-sky-card", title: t("l.about.c1t"), body: t("l.about.c1b") },
    { surface: "bg-peach-card", title: t("l.about.c2t"), body: t("l.about.c2b") },
    { surface: "bg-sage-card", title: t("l.about.c3t"), body: t("l.about.c3b") },
  ];
  return (
    <section id="about" className="scroll-mt-20 bg-bone">
      <div className="mx-auto max-w-[1200px] px-6 py-[80px]">
        <SectionHead title={t("l.about.title")} body={t("l.about.body")} center />
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((c) => (
            // One surface colour per tile; depth comes from the colour shift,
            // never a shadow.
            <div key={c.title} className={`rounded-arva-card p-[30px] ${c.surface}`}>
              <LeafMark className="h-7 w-7 text-forest-ink" />
              <h3 className="mt-6 font-sans text-[22px] font-medium leading-tight tracking-[-0.015em] text-charcoal">
                {c.title}
              </h3>
              <p className="mt-3 font-sans text-[15px] font-light leading-[1.6] text-graphite">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Forest interstitial: photo + the three steps ─────────────────────────── */
function HowItWorks() {
  const { t } = useT();
  const steps = [
    { t: t("l.how.s1t"), b: t("l.how.s1b") },
    { t: t("l.how.s2t"), b: t("l.how.s2b") },
    { t: t("l.how.s3t"), b: t("l.how.s3b") },
  ];
  return (
    <section className="bg-bone">
      <div className="mx-auto max-w-[1200px] px-6 pb-[80px]">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div
            className="min-h-[320px] rounded-arva-card bg-cover bg-center"
            style={{ backgroundImage: "url('/images/tile-hands.png')" }}
            role="img"
            aria-label="A farmer working the land"
          />
          <div className="rounded-arva-card bg-arva-band p-[30px] sm:p-10">
            <p className="font-sans text-[13px] font-medium uppercase tracking-[0.025em] text-vivid-lime">
              {t("l.how.kicker")}
            </p>
            <div className="mt-4">
              <SectionHead title={t("l.how.title")} tone="light" />
            </div>
            <div className="mt-10 space-y-7">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 font-sans text-[13px] font-medium text-vivid-lime">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-sans text-[16px] font-semibold text-white">{s.t}</h3>
                    <p className="mt-1.5 font-sans text-[14px] font-light leading-[1.55] text-white/75">
                      {s.b}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Capabilities ─────────────────────────────────────────────────────────── */
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
    <section className="bg-bone">
      <div className="mx-auto max-w-[1200px] px-6 pb-[80px]">
        <p className="font-sans text-[13px] font-medium uppercase tracking-[0.025em] text-pewter">
          {t("l.cap.kicker")}
        </p>
        <div className="mt-4">
          <SectionHead title={t("l.cap.title")} body={t("l.cap.body")} />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {caps.map((c, i) => (
            <div key={i} className="rounded-arva-card border border-moss bg-pure-white p-[30px]">
              <span className="font-sans text-[13px] font-medium tracking-[0.025em] text-forest-ink">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-sans text-[18px] font-medium tracking-[-0.015em] text-charcoal">
                {c.t}
              </h3>
              <p className="mt-2 font-sans text-[14px] font-light leading-[1.6] text-graphite">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
function Stats() {
  const { t } = useT();
  const stats = [
    { n: t("a.ben.s1n"), c: t("a.ben.s1t") },
    { n: t("a.ben.s2n"), c: t("a.ben.s2t") },
    { n: t("a.ben.s3n"), c: t("a.ben.s3t") },
  ];
  return (
    <section className="bg-bone">
      <div className="mx-auto max-w-[1200px] px-6 pb-[80px]">
        <p className="font-sans text-[13px] font-medium uppercase tracking-[0.025em] text-pewter">
          {t("a.ben.label")}
        </p>
        <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {stats.map((s, i) => {
            // Not every stat is a numeral — a.ben.s3n is the word "Seconds", and
            // a word set at 80px next to "9" and "8" reads as a broken layout
            // rather than a matching one. Words get their own, smaller size.
            const numeric = /^[\d.,]+\+?%?$/.test(s.n.trim());
            return (
            <div key={i} className="border-t border-moss pt-6">
              <p
                className={`font-sans font-extralight leading-none tracking-[-0.037em] text-forest-ink ${
                  numeric ? "text-[54px] sm:text-[80px]" : "text-[34px] sm:text-[44px]"
                }`}
              >
                {s.n}
              </p>
              <p className="mt-4 max-w-[28ch] font-sans text-[14px] font-light leading-[1.55] text-graphite">
                {s.c}
              </p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Closing CTA ──────────────────────────────────────────────────────────── */
function CtaBand() {
  const { t } = useT();
  return (
    <section className="bg-bone pb-[80px]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="rounded-arva-card bg-arva-band px-8 py-16 text-center sm:px-12">
          <h2 className="mx-auto max-w-[20ch] font-sans text-[30px] font-light leading-[1.08] tracking-[-0.022em] text-white sm:text-[45px]">
            {t("l.cta2.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] font-sans text-[16px] font-light leading-[1.6] text-white/80 sm:text-[17px]">
            {t("l.cta2.body")}
          </p>
          <Link
            href="/onboarding"
            className="mt-9 inline-block rounded-arva-btn bg-vivid-lime px-8 py-3 font-sans text-[14px] font-semibold uppercase tracking-[0.025em] text-charcoal transition-transform hover:-translate-y-0.5"
          >
            {t("l.cta2.btn")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function Footer() {
  const { t } = useT();
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  // Every entry points somewhere real. Arva's footer has a fourth column of
  // Docs/Guides/Support/Status, but we have no such pages, and a column of dead
  // links is worse than a narrower footer — so that slot holds the legal
  // documents that do exist, opened as the same modals onboarding uses.
  const cols: { head: string; links: { label: string; href?: string; onClick?: () => void }[] }[] = [
    {
      head: t("l.foot.product"),
      links: [
        { label: t("l.cta.demo"), href: "/login?next=/onboarding" },
        { label: t("l.hero.farmer"), href: "/login" },
        { label: t("l.hero.company"), href: "/jaivik-sathi" },
      ],
    },
    {
      head: t("l.foot.company"),
      links: [
        { label: t("l.nav.about"), href: "/about" },
        { label: t("l.nav.team"), href: "/team" },
        { label: t("l.nav.arch"), href: "/architecture" },
      ],
    },
    {
      head: t("l.foot.resources"),
      links: [
        { label: t("onboarding.termsLink"), onClick: () => setLegal("terms") },
        { label: t("onboarding.privacyLink"), onClick: () => setLegal("privacy") },
      ],
    },
  ];

  return (
    <footer className="bg-arva-band">
      <div className="mx-auto max-w-[1200px] px-6 pb-14 pt-[110px]">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 text-white">
              <LeafMark className="h-5 w-5 text-vivid-lime" />
              <span className="font-sans text-[19px] font-medium tracking-[-0.02em]">Agent Farmer</span>
            </div>
            <p className="mt-4 max-w-[30ch] font-sans text-[14px] font-light leading-[1.6] text-white/70">
              {t("a.hero.sub")}
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.head}>
              <p className="font-sans text-[13px] font-medium uppercase tracking-[0.025em] text-white/65">
                {c.head}
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href ? (
                      <a
                        href={l.href}
                        className="font-sans text-[15px] font-light text-white/80 transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <button
                        onClick={l.onClick}
                        className="text-left font-sans text-[15px] font-light text-white/80 transition-colors hover:text-white"
                      >
                        {l.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-white/15 pt-6">
          <p className="font-sans text-[13px] font-light text-white/55">
            © {new Date().getFullYear()} Agent Farmer
          </p>
        </div>
      </div>

      {legal === "terms" && <TermsModal onClose={() => setLegal(null)} />}
      {legal === "privacy" && <PrivacyModal onClose={() => setLegal(null)} />}
    </footer>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
function HomeContent() {
  return (
    <main className="min-h-screen bg-bone">
      <SiteHeader />
      <Hero />
      <Quilt />
      <HowItWorks />
      <Capabilities />
      <Stats />
      <CtaBand />
      <FindUs />
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
