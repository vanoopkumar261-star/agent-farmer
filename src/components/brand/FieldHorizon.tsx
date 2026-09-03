/**
 * The field band along the bottom of the full-screen loading state.
 *
 * Furrows converging on a horizon, a farmhouse and a windmill, and a low sun —
 * the landscape from the reference's fourth panel, starting near-white and
 * warming to gold as the load progresses.
 *
 * ── The viewBox is sized to the band, not to the drawing ─────────────────────
 * This lives in a container roughly nine times wider than it is tall, and
 * `slice` scales to cover, so any sky drawn above the horizon is the first
 * thing cropped away. Two earlier attempts lost the sun that way — one
 * magnified it threefold through the middle of the screen, the next trimmed it
 * to a sliver at the bottom edge. The viewBox is therefore authored at 1200×150
 * with the horizon high in the frame, so what survives the crop is the part
 * worth keeping.
 *
 * Geometry is authored once in `FieldGeometry` and rendered twice, pencil then
 * warm, for the same reason the emblem avoids `<use>`: document CSS does not
 * reach into a `<use>` shadow tree, so a shared definition loses the classes
 * that drive it.
 *
 * `af-rise-rect-h` runs the same animation as the emblem's clip, so gold
 * reaches the fields and the grain ear as one gesture. This component is only
 * meaningful rendered beside the mark.
 */
export default function FieldHorizon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 150"
      className={`af-horizon ${className}`}
      fill="none"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Keeps only what sits above the horizon, so the sun rises out of it. */}
        <clipPath id="af-sun-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1200" height="58" />
        </clipPath>
        <clipPath id="af-mark-rise-h" clipPathUnits="userSpaceOnUse">
          <rect className="af-rise-rect-h" x="0" y="0" width="1200" height="150" />
        </clipPath>
      </defs>

      {/* Pencil pass — the faint version, present from the first frame. */}
      <g className="af-pencil-h">
        <FieldGeometry />
      </g>

      {/* Warm pass — same geometry, uncovered by the shared rising clip. */}
      <g clipPath="url(#af-mark-rise-h)">
        <FieldGeometry warm />
      </g>
    </svg>
  );
}

/**
 * Rendered twice; `warm` swaps the palette and adds the ground wash.
 *
 * Deliberately quiet. This is the backdrop to a wordmark, not the subject — the
 * reference's landscape sits well behind its emblem, and a band of strong gold
 * lines competes with the thing the farmer is actually waiting to read.
 */
function FieldGeometry({ warm = false }: { warm?: boolean }) {
  const ink = warm ? "rgb(var(--af-amber))" : "rgb(var(--af-border))";

  return (
    <g stroke={ink} fill="none" strokeLinecap="round" opacity={warm ? 1 : 0.7}>
      {/* Half-sunk sun — a sunrise, not a circle hanging in the sky. */}
      <g clipPath="url(#af-sun-clip)">
        <circle cx="600" cy="58" r="30" strokeWidth="1.5" opacity="0.5" />
      </g>
      {warm && (
        <g strokeWidth="1.1" opacity="0.2">
          <path d="M600 14v-9M556 24l-7-8M644 24l7-8M532 54h-13M668 54h13" />
        </g>
      )}

      {/* Horizon. */}
      <path d="M0 58H1200" strokeWidth="1.4" opacity="0.45" />

      {/* Furrows radiating from the vanishing point. */}
      <g strokeWidth="1" opacity="0.32">
        <path d="M600 60 30 150M600 60 175 150M600 60 320 150M600 60 462 150M600 60 600 150M600 60 738 150M600 60 880 150M600 60 1025 150M600 60 1170 150" />
      </g>

      {/* Contour bands, so the ground reads as ploughed land, not a starburst. */}
      <g strokeWidth="0.9" opacity="0.24">
        <path d="M336 88C440 82 760 82 864 88M232 120C398 111 802 111 968 120" />
      </g>

      {/* The two sweeping field boundaries from the reference. */}
      <path d="M0 132C224 102 424 72 600 60M1200 132C976 102 776 72 600 60"
        strokeWidth="1.4" opacity="0.5" />

      {/* Farmhouse, standing on the horizon. */}
      <path d="M764 58V40h24v18M759 40l18-12 18 12" strokeWidth="1.3" opacity="0.55" />

      {/* Windmill — tower and four sails. */}
      <path d="M860 58 864 26M864 26 850 16M864 26 879 18M864 26 853 39M864 26 877 37"
        strokeWidth="1.3" opacity="0.55" />

      {/* Ground wash once warm, so the band reads as land rather than linework. */}
      {warm && (
        <path
          d="M0 132C224 102 424 72 600 60C776 72 976 102 1200 132V150H0Z"
          fill="rgb(var(--af-amber))"
          fillOpacity="0.07"
          stroke="none"
        />
      )}
    </g>
  );
}
