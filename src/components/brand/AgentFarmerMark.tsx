/**
 * The Agent Farmer mark, drawing itself.
 *
 * A grain ear with a circuit node grafted at its tip — farming plus the thing
 * that reads the field for you. Hand-authored rather than exported from a
 * drawing tool so it stays a handful of readable curves; generated path data
 * would bloat every route that can show a loading state.
 *
 * ── Geometry lives in one array, rendered twice ──────────────────────────────
 * The mark is drawn as two stacked passes: an unfinished pencil version, and
 * the finished ink version revealed by a rising clip. Both come from `STROKES`
 * below, so a curve is only ever edited in one place.
 *
 * It is deliberately NOT `<use href="#...">`, which is the obvious way to draw
 * something twice. A `<use>` clones into a shadow tree that document CSS
 * selectors do not reach: only inherited properties cross the boundary, so the
 * per-path classes carrying the draw animation silently stopped applying and
 * the pale pencil clone painted straight over the ink. Mapping an array costs
 * a few more DOM nodes and behaves exactly as written.
 *
 * ── How the animation works ──────────────────────────────────────────────────
 *  1. `pathLength="1"` normalises every curve to length 1 regardless of its
 *     real geometry, so one CSS rule (dasharray 1, dashoffset 1 → 0) draws them
 *     all at the same rate. Reshape a curve and the timing still holds.
 *  2. A single clip rect slides upward to uncover the coloured pass. The same
 *     motion drives the landscape, so gold rises through the whole composition
 *     as one gesture rather than several that drift apart.
 *  3. The drafting guides animate *out* as the ink lands — the construction
 *     marks being erased. That transition is what sells the reference's first
 *     two panels; without it the mark merely fades in.
 *
 * Colour comes from the app's own tokens, not the reference's literal black and
 * gold, so this reads as the product's front door rather than a borrowed splash.
 */

type Stroke = { d: string; delay: number; cls?: string };

/** The ear, base upward. Delays stagger the draw from the root to the tip. */
const STROKES: Stroke[] = [
  { d: "M60 162V40", delay: 0 },

  // Three tapering pairs of grain leaves, widest at the base.
  { d: "M60 158C44 152 32 140 34 118C48 128 57 142 60 158Z", delay: 0.14 },
  { d: "M60 158C76 152 88 140 86 118C72 128 63 142 60 158Z", delay: 0.14 },
  { d: "M60 128C46 122 36 110 38 92C50 101 57 114 60 128Z", delay: 0.28 },
  { d: "M60 128C74 122 84 110 82 92C70 101 63 114 60 128Z", delay: 0.28 },
  { d: "M60 100C48 95 40 84 43 70C53 78 58 88 60 100Z", delay: 0.42 },
  { d: "M60 100C72 95 80 84 77 70C67 78 62 88 60 100Z", delay: 0.42 },

  // The pointed arch that closes the ear.
  { d: "M46 74C46 56 51 44 60 34C69 44 74 56 74 74", delay: 0.56 },

  // The circuit node — the one element that is not botanical, and the whole
  // argument of the mark in miniature.
  { d: "M60 44 76 32", delay: 0.8 },

  // Two arcs sweeping the mark, drawn last.
  { d: "M22 128A46 46 0 0 1 40 38", delay: 1.02, cls: "af-arc" },
  { d: "M98 128A46 46 0 0 0 80 38", delay: 1.12, cls: "af-arc" },
];

/** Filled shapes — the lower leaves and the node terminal. */
const GOLD = [
  "M60 158C44 152 32 140 34 118C48 128 57 142 60 158Z",
  "M60 158C76 152 88 140 86 118C72 128 63 142 60 158Z",
  "M60 128C46 122 36 110 38 92C50 101 57 114 60 128Z",
  "M60 128C74 122 84 110 82 92C70 101 63 114 60 128Z",
];

export default function AgentFarmerMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 172"
      className={`af-mark ${className}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Starts fully below the artwork and slides up, so the finished pass is
            uncovered from the ground upward. */}
        <clipPath id="af-mark-rise" clipPathUnits="userSpaceOnUse">
          <rect className="af-rise-rect" x="0" y="0" width="120" height="172" />
        </clipPath>
      </defs>

      {/* Drafting geometry: centre line, the box the ear is struck in, and the
          circle its leaves follow. Erased as the ink arrives. */}
      <g className="af-sketch" stroke="rgb(var(--af-border))" strokeWidth="0.7" fill="none">
        <path d="M60 14V166" />
        <rect x="26" y="30" width="68" height="132" />
        <circle cx="60" cy="98" r="42" />
        <path d="M30 60 90 136M90 60 30 136" strokeWidth="0.5" />
      </g>

      {/* Pencil pass — the unfinished mark, present from the first frame. */}
      <g className="af-pencil" stroke="rgb(var(--af-border))" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round" fill="none">
        {STROKES.map((s, i) => (
          <path key={i} d={s.d} />
        ))}
        <circle cx="80" cy="29" r="5.5" />
      </g>

      {/* Finished pass — gold beneath, ink on top, uncovered by the rising clip. */}
      <g clipPath="url(#af-mark-rise)">
        <g className="af-gold" fill="rgb(var(--af-amber))" stroke="none">
          {GOLD.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <circle cx="80" cy="29" r="5.5" />
        </g>

        <g fill="none">
          {STROKES.map((s, i) => (
            <path
              key={i}
              className={`af-ink ${s.cls ?? ""}`}
              style={{ "--d": `${s.delay}s` } as React.CSSProperties}
              pathLength="1"
              d={s.d}
            />
          ))}
          <circle
            className="af-ink"
            style={{ "--d": "0.92s" } as React.CSSProperties}
            pathLength="1"
            cx="80"
            cy="29"
            r="5.5"
          />
        </g>
      </g>
    </svg>
  );
}
