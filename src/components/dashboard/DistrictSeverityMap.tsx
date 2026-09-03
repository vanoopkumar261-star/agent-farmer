"use client";

import { useMemo } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { SEVERITY, type SeverityKey } from "@/lib/chartTheme";
import {
  centroidOf,
  contourPath,
  contourRings,
  extentOf,
  makeProjector,
  outerRings,
  ringsToPath,
  withinExtent,
  type GeoJsonGeometry,
} from "@/lib/hazards/geometry";

/**
 * The farmer's own district, glowing by severity.
 *
 * Sits above the alert list in the emergency popup and answers the question a
 * second before the text does: green and quiet means nothing is in force, and
 * the shape burns brighter as warnings land.
 *
 * ── What each mark is allowed to mean ────────────────────────────────────────
 * This is inside a safety feature, so nothing here is decoration pretending to
 * be data:
 *
 *   outline          the actual district that was checked
 *   glow position    the farmer's actual coordinates
 *   glow colour      the highest band in force
 *   glow intensity   how severe that band is
 *   contour rings    NOTHING — visual structure only
 *
 * The rings are the single ornamental element, which is exactly why they are
 * uniform and faint. SACHET names districts and its polygon endpoint is a hard
 * 403, so there is no sub-district data anywhere in this system. Rings that
 * varied across the shape would read as isobars and invent a "this corner is
 * worse" that nobody can back up.
 *
 * ── Motion ───────────────────────────────────────────────────────────────────
 * Slow breathing when clear; a faster, stronger pulse ONLY for red; yellow and
 * orange hold still. Movement therefore means something — a moving map is an
 * emergency — instead of being ambient decoration. Silenced entirely under
 * prefers-reduced-motion.
 */

const SIZE = 240;
const PAD = 16;
/** Ring inset factors and their point budgets — coarser as they go inward. */
const RINGS: [number, number, number][] = [
  // [scale, points, opacity]
  [0.82, 40, 0.3],
  [0.64, 28, 0.22],
  [0.46, 20, 0.16],
];

export type SeverityMapProps = {
  district: string | null;
  geojson: GeoJsonGeometry | null;
  home: { lat: number; lng: number } | null;
  band: SeverityKey;
  /** Number of warnings in the active band, for the caption. */
  count: number;
};

const ICON: Record<SeverityKey, typeof ShieldCheck> = {
  clear: ShieldCheck,
  yellow: Info,
  orange: AlertTriangle,
  red: ShieldAlert,
};

export default function DistrictSeverityMap({
  district,
  geojson,
  home,
  band,
  count,
}: SeverityMapProps) {
  const { t } = useT();
  const colour = SEVERITY[band];
  const Icon = ICON[band];

  const shape = useMemo(() => {
    const rings = outerRings(geojson);
    const extent = extentOf(rings);
    if (!rings.length || !extent) return null;

    const project = makeProjector(extent, SIZE, PAD);
    const centroid = centroidOf(rings);
    if (!centroid) return null;

    // A home point outside the district's own bbox means the district match was
    // wrong. Fall back to the centroid and drop the "you" dot rather than
    // planting it somewhere false — a confident marker in the wrong place is
    // worse than no marker.
    const homeInside =
      home != null && withinExtent(extent, home.lng, home.lat);
    const glowAt = homeInside ? project(home!.lng, home!.lat) : project(centroid[0], centroid[1]);

    return {
      outline: ringsToPath(rings, project),
      contours: contourRings(rings, centroid, RINGS.map((r) => r[0])).map((level, i) =>
        contourPath(level, project, RINGS[i][1])
      ),
      glowAt,
      showHomeDot: homeInside,
    };
  }, [geojson, home]);

  const label =
    band === "clear"
      ? t("hazardMap.clear", { district: district ?? "" })
      : t(`hazardMap.${band}`, { district: district ?? "", n: count });

  // No geometry — a plain severity band, so the popup still opens with an
  // unmistakable colour rather than a hole where a map should be.
  if (!shape) {
    return (
      <div
        className="rounded-2xl border px-4 py-3 flex items-center gap-2.5"
        style={{ borderColor: `${colour}55`, background: `${colour}14` }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: colour }} />
        <span className="text-[13px] font-semibold text-af-ink">{label}</span>
      </div>
    );
  }

  const urgent = band === "red";

  return (
    <figure className="m-0 flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[260px] h-auto af-sevmap"
        style={{ ["--sev" as string]: colour }}
        // Drives which animation (if any) plays — see globals.css.
        data-band={band}
        role="img"
        aria-label={label}
      >
        <defs>
          <radialGradient id="sev-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colour} stopOpacity={urgent ? 0.85 : 0.55} />
            <stop offset="55%" stopColor={colour} stopOpacity={urgent ? 0.35 : 0.2} />
            <stop offset="100%" stopColor={colour} stopOpacity="0" />
          </radialGradient>
          <filter id="sev-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {/* Everything inside the district, and nothing outside it. */}
          <clipPath id="sev-clip">
            <path d={shape.outline} />
          </clipPath>
        </defs>

        <path d={shape.outline} fill={colour} fillOpacity="0.1" />

        <g clipPath="url(#sev-clip)">
          <circle
            cx={shape.glowAt.x}
            cy={shape.glowAt.y}
            r={SIZE * 0.42}
            fill="url(#sev-glow)"
            filter="url(#sev-blur)"
            className="af-sevmap-glow"
          />
          {shape.contours.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={colour}
              strokeOpacity={RINGS[i][2]}
              strokeWidth="0.9"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <path
          d={shape.outline}
          fill="none"
          stroke={colour}
          strokeWidth="1.8"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {shape.showHomeDot && (
          <g className="af-sevmap-home">
            <circle cx={shape.glowAt.x} cy={shape.glowAt.y} r="5.5" fill={colour} fillOpacity="0.25" />
            <circle
              cx={shape.glowAt.x}
              cy={shape.glowAt.y}
              r="2.6"
              fill={colour}
              stroke="#fff"
              strokeWidth="1.2"
            />
          </g>
        )}
      </svg>

      {/* The caption is not optional. Yellow sits at 2.15 contrast on white and
          is legible only because the state is also stated in words beside an
          icon — a status colour never carries meaning alone. */}
      <figcaption className="mt-2 flex items-center gap-2 text-center">
        <Icon className="w-4 h-4 shrink-0" style={{ color: colour }} />
        <span className="text-[13px] font-semibold text-af-ink">{label}</span>
      </figcaption>
    </figure>
  );
}
