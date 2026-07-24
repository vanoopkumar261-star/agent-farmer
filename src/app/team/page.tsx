"use client";

import React from "react";
import { LanguageProvider, useT } from "@/components/i18n/LanguageProvider";
import SiteHeader, { LeafMark } from "@/components/landing/SiteHeader";

/* ────────────────────────────────────────────────────────────────────────────
   Agent Farmer — Team page (Agent Farmer OS re-theme)
   Light airy canvas · staggered B&W portrait grid on glass cards with emerald /
   blue glow backings · forest-glass hover popup · Plus Jakarta + JetBrains Mono.
   ──────────────────────────────────────────────────────────────────────────── */

type Member = {
  name: string;
  img: string;
  glow: string;
  role: string;
  desc: string;
  offset: string;
};

const MEMBERS: Member[] = [
  {
    name: "Anoopkumar V",
    img: "/team/anoopkumar-v.png",
    glow: "rgba(16,185,129,0.25)",
    role: "Team Lead · LLM Developer & 3-D Designer",
    desc: "Never settle.",
    offset: "md:mt-16",
  },
  {
    name: "Barsha Sharma",
    img: "/team/barsha-sharma.png",
    glow: "rgba(59,130,246,0.22)",
    role: "Content Researcher & Tester",
    desc: "Curious mind exploring AI and software to solve real-world challenges. Thriving on innovation, teamwork, and continuous learning.",
    offset: "md:mt-40",
  },
  {
    name: "Manan Agrawal",
    img: "/team/manan-agrawal.png",
    glow: "rgba(16,185,129,0.25)",
    role: "Database Manager & Backend Developer",
    desc: "Gamble with the knowledge or be poor.",
    offset: "md:mt-6",
  },
  {
    name: "Sahajtha Singh",
    img: "/team/sahajtha-singh.png",
    glow: "rgba(59,130,246,0.22)",
    role: "UI Designer & Curator",
    desc: "Fueled by creativity and curiosity. Building skills, chasing ideas, and enjoying the process.",
    offset: "md:mt-28",
  },
  {
    name: "Shiven Chopra",
    img: "/team/shiven-chopra.png",
    glow: "rgba(16,185,129,0.25)",
    role: "i18n Architect & Designer",
    desc: "Working with passion.",
    offset: "md:mt-12",
  },
];

function MemberCard({ m }: { m: Member }) {
  return (
    <div className={`group relative ${m.offset}`}>
      {/* soft gradient glow backing — depth without a hard shadow */}
      <div
        className="absolute -inset-3 -z-10 rounded-[26px] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: m.glow }}
      />
      {/* portrait tile with gradient hairline */}
      <div className="of-ring rounded-[22px] p-px shadow-of-card transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-of-float">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[21px] bg-of-forest">
          <img
            src={m.img}
            alt={m.name}
            className="h-full w-full object-cover object-top grayscale transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-of-ink/80 to-transparent px-4 pb-3 pt-8 transition-opacity duration-300 group-hover:opacity-0">
            <p className="font-sans text-[14px] font-semibold text-white">{m.name}</p>
          </div>
        </div>
      </div>

      {/* forest-glass hover popup */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[260px] max-w-[85vw] -translate-x-1/2 -translate-y-1/2 scale-95 rounded-[24px] border border-white/10 bg-of-forest/90 p-6 text-center opacity-0 shadow-of-float backdrop-blur-xl transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
        <img
          src={m.img}
          alt=""
          className="mx-auto h-28 w-28 rounded-full object-cover object-top grayscale ring-2 ring-of-primary/40"
        />
        <h3 className="mt-5 font-sans text-[20px] font-bold leading-tight text-white">{m.name}</h3>
        <p className="mt-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-of-primary">
          {m.role}
        </p>
        <p className="mt-3 font-sans text-[13px] font-normal leading-[1.5] text-white/75">{m.desc}</p>
      </div>
    </div>
  );
}

function TeamContent() {
  const { t } = useT();
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-of-bg font-sans">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="of-canvas absolute inset-0" />
        <div className="of-dotgrid absolute inset-0 opacity-[0.5]" />
        <div className="relative mx-auto max-w-[1200px] px-6 pb-32 pt-12">
          {/* giant faint background wordmark */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-4 select-none font-sans font-extrabold leading-[0.82] tracking-[-0.04em] text-of-forest/[0.06]"
          >
            <div className="text-[20vw] md:text-[14vw]">the</div>
            <div className="-mt-2 text-[20vw] md:text-[14vw]">team</div>
          </div>

          {/* section index */}
          <div className="relative z-10 flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.2em]">
            <span className="inline-block h-2 w-2 rounded-sm bg-of-primary shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-of-muted">04</span>
            <span className="ml-3 text-of-primary">{t("l.nav.team")}</span>
          </div>

          {/* intro */}
          <div className="relative z-10 mt-6 max-w-[46ch]">
            <h1 className="font-sans text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-of-ink sm:text-[46px]">
              {t("l.team.title")}
            </h1>
            <p className="mt-4 font-sans text-[16px] font-normal leading-[1.6] text-of-body">
              {t("l.team.body")}
            </p>
          </div>

          {/* staggered grid */}
          <div className="relative z-10 mt-16 grid grid-cols-2 gap-x-5 gap-y-10 md:mt-24 md:grid-cols-5 md:gap-x-6">
            {MEMBERS.map((m) => (
              <MemberCard key={m.name} m={m} />
            ))}
          </div>
        </div>
      </section>

      {/* slim forest footer */}
      <footer className="relative overflow-hidden bg-of-forest">
        <div className="of-grad-emerald pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" />
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <a href="/" className="flex items-center gap-2.5 text-white">
            <span className="of-grad-emerald flex h-8 w-8 items-center justify-center rounded-xl">
              <LeafMark className="h-4 w-4 text-white" />
            </span>
            <span className="font-sans text-[16px] font-bold tracking-tight">Agent Farmer</span>
          </a>
          <p className="font-sans text-[13px] font-normal text-white/50">
            © {new Date().getFullYear()} Agent Farmer. {t("l.foot.rights")}
          </p>
        </div>
      </footer>
    </main>
  );
}

export default function TeamPage() {
  return (
    <LanguageProvider>
      <TeamContent />
    </LanguageProvider>
  );
}
