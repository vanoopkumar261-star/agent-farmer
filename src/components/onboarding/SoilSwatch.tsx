/**
 * The five soil types, drawn rather than photographed.
 *
 * ── Why these are not photographs ────────────────────────────────────────────
 * The irrigation cards beside these are real Wikimedia photos, because a canal
 * and a sprinkler photograph well. Soil does not. Three sourcing passes over
 * Commons and Wikipedia returned, for "black cotton soil", a world distribution
 * map, an electron micrograph and a photograph of a crane; for "red soil", a
 * stone monument commemorating a laterite conference. Soil articles are written
 * about taxonomy, and taxonomy does not photograph.
 *
 * What a farmer actually recognises about their soil is two things: its colour
 * and how it breaks. Both are drawable, and drawing them means the black soil
 * is reliably black and cracks the way vertisols crack, rather than being
 * whatever the top of an encyclopedia article happened to be.
 *
 * Colours are the field-moist ranges these soils actually show in India:
 * regur/black cotton is a very dark grey-brown, laterite red is rust from iron
 * oxide, alluvial is pale grey-brown silt, sandy is a light buff, and clay sits
 * between red and brown. They are not brand colours and should not be swapped
 * for brand colours — the accuracy is the entire point of the card.
 */

export type SoilKey = "alluvial" | "black" | "red" | "sandy" | "clayey";

type Look = {
  /** base, mid, deep — top to bottom, so the swatch reads as depth. */
  colors: [string, string, string];
  /** How this soil breaks up, which is as diagnostic as the colour. */
  texture: "cracked" | "grainy" | "clumped" | "fine";
};

const LOOKS: Record<SoilKey, Look> = {
  // Fine river silt — pale, smooth, no strong structure.
  alluvial: { colors: ["#A99274", "#8E7658", "#6F5B41"], texture: "fine" },
  // Regur. Very dark, and it cracks into deep polygons when it dries.
  black: { colors: ["#4A443E", "#332F2B", "#211E1B"], texture: "cracked" },
  // Laterite. Iron oxide rust, breaks into hard clods.
  red: { colors: ["#A9553A", "#8C4029", "#6B2F1D"], texture: "clumped" },
  // Light, loose, visibly granular.
  sandy: { colors: ["#D8C39A", "#C4AB7C", "#A98F60"], texture: "grainy" },
  // Heavy ochre-brown, cracks finer and shallower than regur.
  clayey: { colors: ["#9C7550", "#805C3B", "#5F4229"], texture: "cracked" },
};

/**
 * A deterministic pseudo-random generator.
 *
 * The speckle and crack positions must not move between renders — a swatch that
 * reshuffles on every keystroke in the form beside it looks broken. Seeding from
 * the soil key gives each type its own stable pattern.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const seedOf = (k: string) => [...k].reduce((a, c) => a + c.charCodeAt(0), 7);

/** Polygonal cracks, the way a drying vertisol actually breaks. */
function cracks(key: SoilKey, deep: string) {
  const r = rng(seedOf(key));
  const lines: string[] = [];
  // A few long primary cracks across the block…
  for (let i = 0; i < 5; i++) {
    const x = 10 + r() * 80;
    lines.push(`M ${x} 0 L ${x + (r() * 24 - 12)} 50 L ${x + (r() * 30 - 15)} 100`);
  }
  // …then shorter ones branching off them, which is what makes it read as soil
  // rather than as a cracked screen.
  for (let i = 0; i < 7; i++) {
    const x = r() * 100;
    const y = r() * 100;
    lines.push(`M ${x} ${y} L ${x + (r() * 26 - 13)} ${y + (r() * 20 - 10)}`);
  }
  return lines.map((d, i) => (
    <path
      key={i}
      d={d}
      stroke={deep}
      strokeWidth={i < 5 ? 1.4 : 0.7}
      strokeLinecap="round"
      fill="none"
      opacity={i < 5 ? 0.85 : 0.55}
    />
  ));
}

/** Loose grains — sandy soil is recognised by the grain, not the colour alone. */
function grains(key: SoilKey, light: string, deep: string) {
  const r = rng(seedOf(key));
  return Array.from({ length: 90 }, (_, i) => (
    <circle
      key={i}
      cx={r() * 100}
      cy={r() * 100}
      r={0.5 + r() * 0.9}
      fill={r() > 0.5 ? light : deep}
      opacity={0.5 + r() * 0.4}
    />
  ));
}

/** Hard clods, as laterite breaks. */
function clods(key: SoilKey, deep: string, light: string) {
  const r = rng(seedOf(key));
  return Array.from({ length: 16 }, (_, i) => {
    const cx = r() * 100;
    const cy = r() * 100;
    const w = 6 + r() * 12;
    const h = w * (0.6 + r() * 0.5);
    return (
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={w / 2}
        ry={h / 2}
        fill={r() > 0.5 ? deep : light}
        opacity={0.28 + r() * 0.22}
        transform={`rotate(${r() * 180} ${cx} ${cy})`}
      />
    );
  });
}

/** Fine silt — very low contrast mottling, almost smooth. */
function silt(key: SoilKey, deep: string) {
  const r = rng(seedOf(key));
  return Array.from({ length: 40 }, (_, i) => (
    <ellipse
      key={i}
      cx={r() * 100}
      cy={r() * 100}
      rx={3 + r() * 7}
      ry={1 + r() * 3}
      fill={deep}
      opacity={0.10 + r() * 0.12}
      transform={`rotate(${r() * 40 - 20} ${r() * 100} ${r() * 100})`}
    />
  ));
}

export default function SoilSwatch({
  soil,
  className = "",
}: {
  soil: SoilKey;
  className?: string;
}) {
  const look = LOOKS[soil];
  const [base, mid, deep] = look.colors;
  const gid = `soil-grad-${soil}`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Top-to-bottom darkening, so a flat square reads as ground with depth. */}
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={base} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill={`url(#${gid})`} />

      {look.texture === "cracked" && cracks(soil, deep)}
      {look.texture === "grainy" && grains(soil, base, deep)}
      {look.texture === "clumped" && clods(soil, deep, base)}
      {look.texture === "fine" && silt(soil, deep)}
    </svg>
  );
}
