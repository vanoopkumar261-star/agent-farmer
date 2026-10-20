import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Types for the vendored StarBorder.jsx.
 *
 * The component is plain JS with its defaults in the parameter destructuring,
 * and TypeScript reads the props that have no default — `color`, `trailColor`,
 * `backgroundColor`, `textColor`, `borderColor`, `style` — as required, which
 * would force every call site to pass `undefined`. Declaring the surface here
 * keeps the upstream file untouched, which is the whole point of vendoring it
 * verbatim.
 *
 * `[key: string]: unknown` is how the upstream `...rest` spread is described:
 * it is what lets the hero pass `href` through to a next/link `Link`.
 */
declare const StarBorder: (props: {
  /** Element or component to render. Defaults to `button`. */
  as?: ElementType;
  children?: ReactNode;
  /** Colour of the star and its glow. Defaults to white on dark, ink on light. */
  color?: string;
  /** Colour the trail fades into behind the star. Defaults to `color`. */
  trailColor?: string;
  /** Seconds for one lap of the border. The pace holds on any shape. */
  duration?: number;
  direction?: "clockwise" | "counterclockwise";
  /** Stars spaced evenly around the border, up to 6. */
  stars?: number;
  /** Trail length as a share of the border. */
  trailLength?: number;
  /** Border width in pixels. */
  thickness?: number;
  /** Corner radius in pixels. Past half the height it reads as a pill. */
  radius?: number;
  /** Bloom around the star and trail, 0 to 1. */
  glow?: number;
  /** A twinkling glint at the front of each trail, shedding fine stardust. */
  sparkle?: boolean;
  /** What hover and keyboard focus do. */
  hover?: "lap" | "brighten" | "reveal" | "none";
  /** Sends light racing around the border from the point pressed. */
  clickPulse?: boolean;
  /** Picks the default surface, text, border and star colours. */
  theme?: "dark" | "light";
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}) => JSX.Element;

export default StarBorder;
export { StarBorder };
