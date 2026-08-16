"use client";

import { INDIA_PATHS, INDIA_VIEWBOX } from "./indiaPaths";

export type Branch = {
  id: string;
  /** Two lines of the pill label, e.g. ["BENGALURU", "KARNATAKA · HQ"]. */
  label: [string, string];
  lat: number;
  lng: number;
  /** HQ pins glow and carry a label; the rest are quiet dots. */
  primary?: boolean;
  /** Nudges the label pill when it would otherwise leave the frame. */
  labelAnchor?: "left" | "right" | "center";
};

/**
 * Calibration for the source SVG's projection.
 *
 * Measured, not assumed. The mainland outline is a single path (index 56 of 60
 * — the other 59 are the Andaman, Nicobar and Lakshadweep islands), and its
 * `getBBox()` was read in the rendered page:
 *
 *   x 126 → 1588   y 49 → 1664
 *
 * Note this is NOT the viewBox (0 0 1792 1780) — the artwork is inset, so
 * projecting against the viewBox puts every pin several degrees off.
 *
 * That box is fitted to the mainland's true extent, including the full Kashmir
 * this particular source draws:
 *
 *   west  68.03°E  Guhar Moti, Gujarat
 *   east  97.42°E  Kibithu, Arunachal Pradesh
 *   north 37.10°E  head of the claimed Kashmir
 *   south  8.07°N  Kanyakumari  (the islands reach further south but are
 *                                separate paths, excluded from the fit)
 *
 * The fit is linear in both axes with independent scales. The source is an
 * equirectangular plot on a standard parallel near 27°N — the parallel only
 * changes the x:y ratio, which separate scales absorb, so the exact projection
 * never has to be identified. Verified afterwards against Mumbai, Chennai,
 * Kolkata and Kanyakumari, which all land on the coast.
 *
 * Re-measure both constants if the source SVG is ever swapped.
 */
const BOUNDS = { west: 68.03, east: 97.42, north: 37.1, south: 8.07 };
const BOX = { x: 126, y: 49, w: 1462, h: 1615 };

function project(lat: number, lng: number) {
  const x = BOX.x + ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * BOX.w;
  const y = BOX.y + ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * BOX.h;
  return { x, y };
}

/**
 * India, drawn as a stroke-only outline with location pins.
 *
 * Everything is `currentColor` at low opacity, so the map takes the colour of
 * the band around it rather than carrying its own palette. Pins are positioned
 * from real coordinates through `project`, not hand-placed, so adding a second
 * branch later is a matter of one more entry in the array.
 */
export default function IndiaMap({
  branches,
  className,
}: {
  branches: Branch[];
  className?: string;
}) {
  return (
    <svg
      viewBox={INDIA_VIEWBOX}
      className={className}
      role="img"
      aria-label={`Map of India showing ${branches.map((b) => b.label[0]).join(", ")}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" opacity={0.45}>
        {INDIA_PATHS.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {branches.map((b) => {
        const { x, y } = project(b.lat, b.lng);
        const anchor = b.labelAnchor ?? "center";

        // The pill is drawn in SVG rather than HTML so it scales with the map
        // and cannot drift out of alignment on a narrow screen. Width is sized
        // to the longer of the two lines — at 38px the subtitle runs to roughly
        // 0.62em per character, and a pill narrower than its text is worse than
        // no pill at all.
        const pillH = 150;
        const pillW = Math.max(360, Math.round(b.label[1].length * 23 + 90));
        const pillX =
          anchor === "left" ? x - pillW - 40 : anchor === "right" ? x + 40 : x - pillW / 2;
        // Beside the pin when anchored, below it when centred.
        const pillY = anchor === "center" ? y + 40 : y - pillH / 2;

        return (
          <g key={b.id}>
            {b.primary && (
              <circle cx={x} cy={y} r={34} fill="currentColor" opacity={0.18}>
                <animate
                  attributeName="r"
                  values="26;44;26"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.28;0;0.28"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            <circle
              cx={x}
              cy={y}
              r={b.primary ? 15 : 9}
              fill={b.primary ? "var(--af-pin, #e8fe85)" : "currentColor"}
              stroke={b.primary ? "var(--af-pin, #e8fe85)" : "none"}
              strokeWidth={b.primary ? 8 : 0}
              strokeOpacity={0.3}
            />

            {b.primary && (
              <>
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillW}
                  height={pillH}
                  rx={pillH / 2}
                  fill="currentColor"
                  opacity={0.12}
                />
                <rect
                  x={pillX}
                  y={pillY}
                  width={pillW}
                  height={pillH}
                  rx={pillH / 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  opacity={0.35}
                />
                <text
                  x={pillX + pillW / 2}
                  y={pillY + 62}
                  textAnchor="middle"
                  fill="currentColor"
                  className="font-sans"
                  fontSize={46}
                  fontWeight={600}
                  letterSpacing={1}
                >
                  {b.label[0]}
                </text>
                <text
                  x={pillX + pillW / 2}
                  y={pillY + 112}
                  textAnchor="middle"
                  fill="currentColor"
                  className="font-sans"
                  fontSize={38}
                  fontWeight={400}
                  opacity={0.8}
                >
                  {b.label[1]}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
