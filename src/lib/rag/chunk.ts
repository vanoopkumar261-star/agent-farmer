import "server-only";
import { createHash } from "crypto";
import { LIBRARY } from "@/lib/jaivikLibrary";
import { SCHEMES } from "@/lib/schemes";
import { SUPPORTED_CROPS, getCropProfile } from "@/lib/agronomy";
import { cropCard } from "@/lib/cropCatalog";

/**
 * Turning what we have written into passages the assistant can look up.
 *
 * Most retrieval systems lose accuracy at exactly this step, because they cut
 * documents into arbitrary 500-token windows and half the chunks begin
 * mid-thought. We do not need that: every source here is already authored in
 * self-contained units — one scheme, one handbook page, one crop. The natural
 * boundary is the right boundary, so there is no splitter in this file at all.
 *
 * Each chunk carries where it came from, so an answer can cite a real
 * destination: a government URL for a scheme, an in-app library route for a
 * handbook page.
 */

export type Chunk = {
  source: "scheme" | "library" | "agronomy";
  /** Stable within its source, so re-indexing updates rather than duplicates. */
  sourceId: string;
  title: string;
  /** Parent book or crop group — makes a citation read like a reference. */
  parent: string | null;
  link: string | null;
  content: string;
  contentHash: string;
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function chunk(
  source: Chunk["source"],
  sourceId: string,
  title: string,
  parent: string | null,
  link: string | null,
  content: string
): Chunk {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return { source, sourceId, title, parent, link, content: trimmed, contentHash: hash(trimmed) };
}

/**
 * Government schemes — one chunk each.
 *
 * The embedded text deliberately leads with the scheme's name and what it pays,
 * because that is how farmers ask ("do I get the 6000 rupees one?"). Eligibility
 * is spelled out in full: a half-quoted eligibility rule is worse than none when
 * the subject is somebody's money.
 */
function schemeChunks(): Chunk[] {
  return SCHEMES.map((s) =>
    chunk(
      "scheme",
      s.id,
      s.name,
      s.category,
      s.link,
      [
        `${s.name} — ${s.short}.`,
        `Category: ${s.category}.`,
        `Benefit: ${s.benefit}`,
        `Eligibility: ${s.eligibility.join("; ")}.`,
        `Deadline: ${s.deadline}.`,
        `Issued by ${s.authority}.`,
        `Official page: ${s.link}`,
      ].join(" ")
    )
  );
}

/**
 * Handbook pages — one chunk per page across the six Jaivik Sathi books.
 *
 * The book title is prepended to every page's text. Without it a page called
 * "The Gut of the Earth" embeds as poetry about soil and never matches
 * "vermicompost", which is the word a farmer would actually type.
 */
function libraryChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (const book of LIBRARY) {
    const pages = book.pages ?? [];
    pages.forEach((page, i) => {
      const parts = [
        `${book.title} — ${page.title}.`,
        page.header ? `Section: ${page.header}.` : "",
        ...(page.content ?? []),
        ...(page.bullets ?? []),
        page.tip ? `Tip: ${page.tip}` : "",
      ].filter(Boolean);

      out.push(
        chunk(
          "library",
          `${book.slug}#${i}`,
          page.title,
          book.title,
          `/jaivik-sathi/library?book=${book.slug}&page=${i}`,
          parts.join(" ")
        )
      );
    });
  }
  return out;
}

/**
 * Crops — one chunk each, written as sentences rather than field names.
 *
 * The profile is a table of numbers; embedding "cycleDays: 120" matches
 * nothing a human would ask. Rendering it as prose ("takes about 120 days from
 * sowing to harvest") is what makes it findable.
 */
function agronomyChunks(): Chunk[] {
  return SUPPORTED_CROPS.map((name) => {
    const p = getCropProfile(name);
    const card = cropCard(name);
    const water = p.waterHeavy
      ? "It needs heavy irrigation or standing water."
      : "It does not need standing water; moderate irrigation is enough.";

    return chunk(
      "agronomy",
      `crop:${name.toLowerCase()}`,
      p.displayName,
      card.category,
      "/dashboard/crops",
      [
        `${p.displayName} is a ${card.category.toLowerCase()} crop grown in the ${card.season} season.`,
        card.blurb,
        `It takes about ${p.cycleDays} days from sowing to harvest.`,
        `Typical yield is around ${p.yieldPerAcre} quintals per acre.`,
        water,
        `Heat stress becomes a risk above about ${p.heatThreshold}°C at sensitive stages.`,
        p.oilseed ? `${p.displayName} is an oilseed crop.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  });
}

/** Every chunk the assistant can cite. */
export function buildAllChunks(): Chunk[] {
  return [...schemeChunks(), ...libraryChunks(), ...agronomyChunks()];
}
