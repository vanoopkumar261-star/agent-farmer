import type { RefObject } from "react";

/**
 * Types for the vendored LaserFlow.jsx.
 *
 * The component is plain JS with defaults in its parameter destructuring, and
 * TypeScript reads the two props that have no default — `revealImage` and
 * `dpr` — as required, which would force every call site to pass `undefined`.
 * Declaring the surface here keeps the upstream file untouched, which is the
 * whole point of vendoring it verbatim.
 */
declare const LaserFlow: (props: {
  /** The element the beam lands on. Light gathers along its top edge. */
  surfaceRef?: RefObject<HTMLElement | null>;
  /** 0 at the left edge, 1 at the right. */
  beamPosition?: number;
  /** Where the beam lands when no surfaceRef is given. */
  surfaceLevel?: number;
  /** Every other tone is derived by rotating this hue. */
  color?: string;
  intensity?: number;
  beamWidth?: number;
  flare?: number;
  spread?: number;
  /** How much light pours over the surface's corners. */
  spill?: number;
  fog?: number;
  dust?: number;
  streaks?: number;
  dots?: number;
  pulse?: number;
  /** 0 holds the light still. */
  speed?: number;
  seed?: number;
  mouseInteraction?: boolean;
  revealImage?: string;
  revealRadius?: number;
  revealOpacity?: number;
  /** Drops the beam in on mount. */
  intro?: boolean;
  /** "light" for light page backgrounds; the output is tuned differently. */
  theme?: "dark" | "light";
  paused?: boolean;
  /** Capped at 2 internally. */
  dpr?: number;
  className?: string;
}) => JSX.Element;

export default LaserFlow;
export { LaserFlow };
