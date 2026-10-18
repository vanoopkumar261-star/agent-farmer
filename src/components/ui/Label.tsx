"use client";

import React from "react";
import { useT } from "@/components/i18n/LanguageProvider";

/**
 * The uppercase micro-label above a number or a section.
 *
 * This recipe — `font-mono text-[10px] font-bold tracking-[0.18em] uppercase
 * text-af-muted` — was copy-pasted **95 times**, in four different sizes and
 * five different tracking values, while the `text-label` token built for it
 * (11px / 0.16em) was used three times in the whole repo.
 *
 * ── Why the casing is conditional ────────────────────────────────────────────
 *
 * Devanagari, Tamil, Telugu, Malayalam, Kannada, Bengali and Gurmukhi are
 * **unicase** — they have no capital letters. `text-transform: uppercase` is a
 * no-op on all seven, so in eight of this app's nine languages the typographic
 * hierarchy these labels create simply did not exist.
 *
 * The letter-spacing was worse than useless there. `tracking-[0.18em]` pushes
 * every glyph apart, and in Indic scripts a matra or a conjunct is positioned
 * relative to its base consonant — so the tracking pulls vowel signs away from
 * the letters they belong to and makes the word harder to read, in exchange
 * for an effect the script cannot show.
 *
 * So caps and tracking apply to English only. Other locales get the same size,
 * weight and colour, which still reads as a label against body copy.
 */
export default function Label({
  children,
  as: Tag = "span",
  className = "",
  htmlFor,
}: {
  children: React.ReactNode;
  /** `span` by default; pass `"label"` with `htmlFor` for a real form label. */
  as?: "span" | "div" | "label";
  className?: string;
  htmlFor?: string;
}) {
  const { locale } = useT();
  const latin = locale === "en";

  return (
    <Tag
      {...(Tag === "label" && htmlFor ? { htmlFor } : {})}
      className={`block font-mono text-label font-semibold text-af-muted ${
        latin ? "uppercase" : "tracking-normal"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
