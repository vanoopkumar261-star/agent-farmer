"use client";

import Image from "next/image";
import { BadgeCheck } from "lucide-react";

/**
 * The picture picker that replaced the soil and irrigation dropdowns.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Both fields were Radix selects pre-filled with "Alluvial Soil" and "Rain-fed".
 * In the live database that produced 35 of 60 farms as Alluvial and 54 of 60 as
 * Rain-fed — those are not answers, they are a form nobody opened. A farmer who
 * cannot comfortably read a dropdown label will accept whatever it already says.
 *
 * So: no default, and nothing to read in order to choose. The picture carries
 * the meaning and the label underneath confirms it for whoever can read it.
 *
 * Both soil and irrigation cards are photographs. Soil used to be drawn (see
 * SoilSwatch.tsx in the history) purely because no honest photo source existed;
 * once real top-down photographs of the five soils were available the drawings
 * were replaced, because a farmer recognises their own field's soil far faster
 * from a photo than from an illustration of one.
 *
 * Icons sit over both, because a borewell photo and a canal photo are genuinely
 * hard to tell apart at thumbnail size on a phone. The photo carries
 * recognition, the icon carries disambiguation.
 */

export type Choice = {
  /** The canonical English value stored in the database. */
  value: string;
  /** Already-translated display label. */
  label: string;
  /** Slug used for the photo path, when this option has one. */
  slug: string;
  Icon: React.ComponentType<{ className?: string }>;
};

export default function ChoiceCardGrid({
  legend,
  options,
  value,
  onChange,
  kind,
  name,
}: {
  legend: string;
  options: Choice[];
  value: string;
  onChange: (v: string) => void;
  /** Decides whether the visual is a photo or a drawn swatch. */
  kind: "soil" | "irrigation";
  /** Radio-group name — must be unique per farm, or farm 2 steals farm 1's choice. */
  name: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted mb-2">
        {legend}
      </legend>

      <div
        role="radiogroup"
        aria-label={legend}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
      >
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              onClick={() => onChange(o.value)}
              className={`group relative flex flex-col overflow-hidden rounded-[14px] border text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 ${
                selected
                  ? "border-af-primary/50 ring-4 ring-af-primary/15 shadow-af-md"
                  : "border-af-border hover:border-af-primary/30 shadow-af-sm"
              }`}
            >
              {/* Tall enough to be recognisable, short enough that six fit on a
                  phone screen without scrolling past the Continue button. */}
              <div className="relative h-[86px] w-full bg-af-sage">
                <Image
                  src={`/images/${kind}/${o.slug}.webp`}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, 200px"
                  className="object-cover"
                />

                {/* The disambiguator. Water infrastructure — and, at 86px, red
                    and alluvial soil — look alike; the icon does not. */}
                <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-af-card/90 shadow-af-sm">
                  <o.Icon className="h-3.5 w-3.5 text-af-primary-deep" />
                </span>

                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-af-primary text-white shadow-af-sm">
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>

              <span
                className={`px-2.5 py-2 text-[13px] leading-tight ${
                  selected ? "font-semibold text-af-ink" : "font-medium text-af-ink-2"
                }`}
              >
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
