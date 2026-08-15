"use client";

import Image from "next/image";
import { BadgeCheck, CalendarDays, Droplet, Leaf } from "lucide-react";
import { cropCard } from "@/lib/cropCatalog";

export type CropRec = {
  cropName: string;
  suitabilityScore: number;
  confidenceScore: number;
  riskScore: "Low" | "Medium" | "High";
  pros: string[];
  cons: string[];
  estimatedYield: string;
  estimatedProfit: string;
};

/**
 * A recommended crop, led by a photograph.
 *
 * The card itself is the selection control — tapping anywhere but "View guide"
 * chooses the crop. The guide button is a separate <button> rather than nested
 * inside the selecting one, because a button inside a button is invalid HTML and
 * browsers resolve the click unpredictably.
 *
 * Suitability, yield, profit and the pros/cons list are deliberately not on the
 * face of the card; they live in the guide, so the card stays scannable.
 */
export default function CropRecCard({
  rec,
  selected,
  onSelect,
  onViewGuide,
}: {
  rec: CropRec;
  selected: boolean;
  onSelect: () => void;
  onViewGuide: () => void;
}) {
  const card = cropCard(rec.cropName);

  const riskTone =
    rec.riskScore === "Low"
      ? "bg-af-primary/10 text-af-primary-deep"
      : rec.riskScore === "Medium"
      ? "bg-af-amber/10 text-af-amber-ink"
      : "bg-af-danger/10 text-af-danger";

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[18px] border bg-af-card transition-all snap-start shrink-0 w-[300px] sm:w-[330px] ${
        selected
          ? "border-af-primary/50 ring-4 ring-af-primary/15 shadow-af-md"
          : "border-af-border hover:border-af-primary/30 shadow-af-sm"
      }`}
    >
      {/* Photo + selection target */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="text-left outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45"
      >
        <div className="relative h-[168px] w-full bg-af-sage">
          {card.image ? (
            <Image
              src={card.image}
              alt={card.name}
              fill
              sizes="330px"
              className="object-cover"
            />
          ) : (
            // Custom crops have no photograph — a tinted panel beats a broken image.
            <div className="flex h-full w-full items-center justify-center">
              <Leaf className="h-10 w-10 text-af-primary/40" />
            </div>
          )}

          <span className="absolute left-3 top-3 rounded-full bg-af-card/95 px-3 py-1 text-[11px] font-semibold text-af-ink shadow-af-sm">
            {card.category}
          </span>

          {selected && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-af-primary px-2.5 py-1 text-white">
              <BadgeCheck className="h-3.5 h-3.5 w-3.5" />
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em]">
                Selected
              </span>
            </span>
          )}
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[19px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {card.name}
            </h4>
            <Leaf className="h-4 w-4 shrink-0 text-af-primary" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon={<CalendarDays className="h-3 w-3" />} text={card.season} />
            <Chip
              icon={<Droplet className="h-3 w-3" />}
              text={card.water}
              tone={card.water === "High Water" ? "water" : "neutral"}
            />
            <Chip text={`${rec.riskScore} risk`} className={riskTone} />
          </div>

          <p className="mt-3 text-meta text-af-ink-2 leading-relaxed line-clamp-2">
            {card.blurb}
          </p>
        </div>
      </button>

      <div className="mt-auto p-5 pt-4">
        <button
          type="button"
          onClick={onViewGuide}
          className="w-full rounded-[12px] border border-af-border bg-af-card px-4 py-2.5 text-sm font-semibold text-af-primary-deep transition hover:border-af-primary/40 hover:bg-af-sage/40 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45"
        >
          View guide
        </button>
      </div>
    </div>
  );
}

function Chip({
  icon,
  text,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  text: string;
  tone?: "neutral" | "water";
  className?: string;
}) {
  const base =
    className ??
    (tone === "water"
      ? "bg-af-ai/10 text-af-ai"
      : "bg-af-bg border border-af-border text-af-ink-2");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${base}`}
    >
      {icon}
      {text}
    </span>
  );
}
