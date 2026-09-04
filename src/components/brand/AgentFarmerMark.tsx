/**
 * The Agent Farmer mark, grown rather than drawn.
 *
 * A grain ear with a circuit node grafted at its tip — farming plus the thing
 * that reads the field for you. Hand-authored rather than exported from a
 * drawing tool so it stays a handful of readable curves; generated path data
 * would bloat every route that can show a loading state.
 *
 * ── Why this is a plant and not a logo animation ─────────────────────────────
 * This used to draw the finished mark once, beside a progress bar. The mark now
 * *grows* through six stages — seed, sprout, seedling, young plant, mature ear,
 * sensor accents — and that growth IS the progress indicator. The bar is gone.
 * A farmer watching a slow page sees something alive make headway, and the last
 * stage is the logo, so every wait ends on the brand.
 *
 * The geometry made this nearly free: the strokes were already ordered root to
 * tip, in tiers. Stages 3–6 are the original curves, unchanged. Only what sits
 * *below* the old baseline is new.
 *
 * ── The viewBox grew downward, not around ────────────────────────────────────
 * 120×172 → 120×200. Every pre-existing coordinate is untouched; the extra 28
 * units hold the soil line, the seed and its roots. Growing the box the other
 * way would have shifted the ear's optical centre and made the mark appear to
 * jump between here and anywhere else it is used.
 *
 * ── The stem is four segments, not one line ──────────────────────────────────
 * `M60 162V40` cannot lengthen in stages, so it is split at the height of each
 * leaf tier. `stroke-linecap: round` makes the joins invisible. This is the one
 * structural change to the original curves and the reason staging works at all.
 *
 * ── Deliberately not `<use href="#...">` ─────────────────────────────────────
 * A `<use>` clones into a shadow tree that document CSS selectors do not reach:
 * only inherited properties cross the boundary, so per-path classes carrying
 * the draw animation silently stop applying. That bug cost real time here once
 * already. Mapping an array costs a few more DOM nodes and behaves as written.
 *
 * ── No pencil pass, no drafting guides ───────────────────────────────────────
 * Both were right for "a mark draws itself" and are fatal to "a plant grows":
 * either one shows the finished silhouette in frame one, so nothing is left to
 * grow into. They were removed with the bar.
 *
 * `pathLength="1"` normalises every curve to length 1 regardless of its real
 * geometry, so one CSS rule draws them all at the same rate — reshape a curve
 * and the timing still holds.
 */

/**
 * When each stage begins, in seconds after the screen has faded in.
 *
 * The gaps widen on purpose: 0.30 → 0.32 → 0.68 → 1.15 → 1.55. Most route loads
 * finish in one to three seconds, so a linear six-stage schedule would only
 * ever show a seed sitting in the dirt and the animation would be pointless.
 * Front-loading means a fast load still tells a story — germinated, sprouted,
 * seedling by 1.1s — and a genuinely slow one still has somewhere to go.
 *
 * This table is the single source of the schedule. The CSS reads it through
 * custom properties; nothing about timing is written twice.
 */
export const STAGE_START = [0, 0.3, 0.62, 1.3, 2.45, 4.0] as const;

/** Seconds. The arcs start last and never finish — see `af-arc-hold` in the CSS. */
const ARC_START = 5.2;

type Stroke = {
  d: string;
  /** 1–6. Decides which group the stroke lives in, and so when it appears. */
  stage: number;
  /** Small lag within a stage, so a stem visibly pushes its own leaves out. */
  off?: number;
  cls?: string;
};

const STROKES: Stroke[] = [
  // ── Stage 1 — a seed in the ground, and the ground itself ──────────────────
  { d: "M8 162H112", stage: 1, cls: "af-soil" },
  { d: "M58 179C54 186 50 189 45 191", stage: 1, off: 0.18, cls: "af-root" },
  { d: "M62 179C66 186 70 189 75 191", stage: 1, off: 0.18, cls: "af-root" },

  // ── Stage 2 — the first shoot breaks the surface ───────────────────────────
  { d: "M60 162V140", stage: 2 },
  // Seed leaves: small, low, and close to the soil. They dim to basal leaves
  // when the true leaves arrive, which is what actually happens to a seedling
  // and stops them crowding the base of the tier above.
  { d: "M60 161C53 159 48 155 49 149C54 152 58 156 60 161Z", stage: 2, off: 0.14, cls: "af-cotyl" },
  { d: "M60 161C67 159 72 155 71 149C66 152 62 156 60 161Z", stage: 2, off: 0.14, cls: "af-cotyl" },

  // ── Stages 3–5 — the original ear, one leaf tier at a time ─────────────────
  { d: "M60 140V112", stage: 3 },
  { d: "M60 158C44 152 32 140 34 118C48 128 57 142 60 158Z", stage: 3, off: 0.12 },
  { d: "M60 158C76 152 88 140 86 118C72 128 63 142 60 158Z", stage: 3, off: 0.12 },

  { d: "M60 112V78", stage: 4 },
  { d: "M60 128C46 122 36 110 38 92C50 101 57 114 60 128Z", stage: 4, off: 0.12 },
  { d: "M60 128C74 122 84 110 82 92C70 101 63 114 60 128Z", stage: 4, off: 0.12 },

  { d: "M60 78V40", stage: 5 },
  { d: "M60 100C48 95 40 84 43 70C53 78 58 88 60 100Z", stage: 5, off: 0.12 },
  { d: "M60 100C72 95 80 84 77 70C67 78 62 88 60 100Z", stage: 5, off: 0.12 },
  // The pointed arch that closes the ear.
  { d: "M46 74C46 56 51 44 60 34C69 44 74 56 74 74", stage: 5, off: 0.26 },

  // ── Stage 6 — the one element that is not botanical ────────────────────────
  { d: "M60 44 76 32", stage: 6 },
  { d: "M88 21V15", stage: 6, off: 0.34, cls: "af-tick" },
  { d: "M95 27V22", stage: 6, off: 0.42, cls: "af-tick" },
];

/** Leaf tiers that carry a fill behind the outline. Keyed by the stage they join. */
const FILLS: { d: string; stage: number }[] = [
  { d: "M60 158C44 152 32 140 34 118C48 128 57 142 60 158Z", stage: 3 },
  { d: "M60 158C76 152 88 140 86 118C72 128 63 142 60 158Z", stage: 3 },
  { d: "M60 128C46 122 36 110 38 92C50 101 57 114 60 128Z", stage: 4 },
  { d: "M60 128C74 122 84 110 82 92C70 101 63 114 60 128Z", stage: 4 },
];

const delay = (s: Stroke) => `${STAGE_START[s.stage - 1] + (s.off ?? 0)}s`;

function Stage({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <g className="af-stage" style={{ "--s": `${STAGE_START[n - 1]}s` } as React.CSSProperties}>
      {children}
    </g>
  );
}

function StageContent({ n }: { n: number }) {
  return (
    <>
      {FILLS.filter((f) => f.stage === n).map((f, i) => (
        <path key={`f${i}`} className="af-fill" d={f.d} />
      ))}
      {STROKES.filter((s) => s.stage === n).map((s, i) => (
        <path
          key={`s${i}`}
          className={`af-ink ${s.cls ?? ""}`}
          style={{ "--d": delay(s) } as React.CSSProperties}
          pathLength="1"
          d={s.d}
        />
      ))}
    </>
  );
}

export default function AgentFarmerMark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 200"
      className={`af-mark ${className}`}
      style={style}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Below ground. Outside the sway group, because soil does not move. */}
      <Stage n={1}>
        <ellipse className="af-seed" cx="60" cy="174" rx="7" ry="5.5" />
        <StageContent n={1} />
      </Stage>

      {/* Everything above the soil sways together, hinged at the soil line, so
          the plant bends as one thing rather than the tip wobbling alone. */}
      <g className="af-crown">
        {[2, 3, 4, 5, 6].map((n) => (
          <Stage key={n} n={n}>
            <StageContent n={n} />
            {n === 6 && (
              <circle
                className="af-ink af-node-glow"
                style={{ "--d": `${STAGE_START[5] + 0.18}s` } as React.CSSProperties}
                pathLength="1"
                cx="80"
                cy="29"
                r="5.5"
              />
            )}
          </Stage>
        ))}
      </g>

      {/* The two sweeping arcs. Outside every stage group: they are the system
          reading the plant, not part of it, and their timing is their own. */}
      <g>
        <path
          className="af-arc"
          style={{ "--d": `${ARC_START}s` } as React.CSSProperties}
          pathLength="1"
          d="M22 128A46 46 0 0 1 40 38"
        />
        <path
          className="af-arc"
          style={{ "--d": `${ARC_START + 0.1}s` } as React.CSSProperties}
          pathLength="1"
          d="M98 128A46 46 0 0 0 80 38"
        />
      </g>
    </svg>
  );
}
