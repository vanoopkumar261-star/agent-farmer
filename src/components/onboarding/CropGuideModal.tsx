"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Droplet,
  Loader2,
  Scale,
  Sun,
  Sprout,
  Bug,
  Wheat,
  Leaf,
  X,
} from "lucide-react";
import { cropCard } from "@/lib/cropCatalog";

type Facts = {
  crop: string;
  cycleDays: number;
  yieldPerAcre: number;
  waterHeavy: boolean;
  heatThreshold: number;
  stages: string[];
};

type Sections = {
  summary?: string;
  sowing?: string[];
  water?: string[];
  nutrition?: string[];
  pests?: string[];
  harvest?: string[];
};

/**
 * Full growing guide for one crop, opened from a recommendation card.
 *
 * Two tiers, deliberately: the fact strip comes straight from the agronomy
 * engine and renders immediately, so the farmer always gets cycle length, yield
 * and water demand even if the network is slow or Groq is down. The written
 * guidance streams in after and degrades to a plain note when unavailable.
 */
export default function CropGuideModal({
  crop,
  soil,
  irrigation,
  region,
  onClose,
}: {
  crop: string;
  soil?: string;
  irrigation?: string;
  region?: string;
  onClose: () => void;
}) {
  const card = cropCard(crop);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [sections, setSections] = useState<Sections | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/crop-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop, soil, irrigation, region }),
        });
        const data = await res.json();
        if (!alive) return;
        setFacts(data.facts ?? null);
        setSections(data.sections ?? null);
        setNote(data.note ?? null);
      } catch {
        if (alive) setNote("Could not load the guide. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [crop, soil, irrigation, region]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} growing guide`}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-af-ink/50" onClick={onClose} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-af-border bg-af-card shadow-af-float">
        {/* Photo header */}
        <div className="relative h-[180px] w-full shrink-0 bg-af-sage">
          {card.image && (
            <Image src={card.image} alt={card.name} fill sizes="672px" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-af-ink/75 via-af-ink/20 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-af-card/90 text-af-ink transition hover:bg-af-card"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <span className="rounded-full bg-af-card/95 px-3 py-1 text-[11px] font-semibold text-af-ink">
              {card.category}
            </span>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-white leading-tight">
              {card.name}
            </h2>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {/* Facts — always available, straight from the engine. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact
              icon={<CalendarDays className="h-4 w-4" />}
              label="Cycle"
              value={facts ? `${facts.cycleDays} days` : "—"}
            />
            <Fact
              icon={<Scale className="h-4 w-4" />}
              label="Typical yield"
              value={facts ? `${facts.yieldPerAcre} qtl/acre` : "—"}
            />
            <Fact icon={<Droplet className="h-4 w-4" />} label="Water" value={card.water} />
            <Fact
              icon={<Sun className="h-4 w-4" />}
              label="Heat limit"
              value={facts ? `${facts.heatThreshold}°C` : "—"}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-af-bg border border-af-border px-3 py-1 text-[11px] font-semibold text-af-ink-2">
              <Leaf className="h-3 w-3" /> {card.season} season
            </span>
            {facts?.stages?.map((s) => (
              <span
                key={s}
                className="rounded-full bg-af-sage px-2.5 py-1 text-[11px] font-semibold text-af-secondary"
              >
                {s}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-af-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing guidance for your soil and season…
            </div>
          ) : sections ? (
            <div className="mt-6 space-y-5">
              {sections.summary && (
                <p className="text-[15px] leading-relaxed text-af-ink-2">{sections.summary}</p>
              )}
              <Section icon={<Sprout className="h-4 w-4" />} title="Sowing" items={sections.sowing} />
              <Section icon={<Droplet className="h-4 w-4" />} title="Irrigation" items={sections.water} />
              <Section icon={<Leaf className="h-4 w-4" />} title="Nutrition" items={sections.nutrition} />
              <Section icon={<Bug className="h-4 w-4" />} title="Pests & disease" items={sections.pests} />
              <Section icon={<Wheat className="h-4 w-4" />} title="Harvest & storage" items={sections.harvest} />
            </div>
          ) : (
            <p className="mt-6 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink-2">
              {note ?? "Written guidance is unavailable right now — the figures above still apply."}
            </p>
          )}

          <p className="mt-6 text-[11px] text-af-muted">
            Figures come from Agent Farmer&apos;s crop engine. Guidance is AI-assisted — check
            against local advice before acting.
          </p>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-af-border bg-af-bg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-af-primary">{icon}</div>
      <div className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-af-muted">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-af-ink">{value}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 text-af-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-af-sage text-af-secondary">
          {icon}
        </span>
        <h3 className="text-[15px] font-semibold">{title}</h3>
      </div>
      <ul className="mt-2 space-y-1.5 pl-9">
        {items.map((t, i) => (
          <li key={i} className="relative text-meta leading-relaxed text-af-ink-2">
            <span className="absolute -left-4 top-[7px] h-1.5 w-1.5 rounded-full bg-af-primary" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
