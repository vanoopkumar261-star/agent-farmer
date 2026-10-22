/**
 * Types for the vendored `ReflectiveCard.jsx`.
 *
 * The component ships as JavaScript (see the note at the top of it), so its
 * props would otherwise be inferred from the default values — which types
 * `width` and `height` as `number` and rejects the `"100%"` the props table
 * documents. This declares the published surface instead; it is the contract
 * from reactbits.dev, transcribed, not anything of ours.
 */

import type { CSSProperties, ReactNode } from "react";

export type ReflectiveCardProps = {
  /** Name shown on the card. */
  name?: string;
  /** Role shown under the name. */
  role?: string;
  /** Label of the badge in the top left corner. */
  badge?: string;
  /** Label of the status chip in the top right corner. */
  status?: string;
  /** Color of the status dot. */
  statusColor?: string;
  /** Small label above the ID number. */
  idLabel?: string;
  /** ID number shown in the footer. */
  idValue?: string;
  /** Replaces the badge, name and footer entirely. */
  children?: ReactNode;
  /** Dark graphite or light silver metal, with matching text. */
  theme?: "dark" | "light";
  /** Looping video the card reflects. Without one it reflects a soft studio. */
  videoSrc?: string;
  /** Reflects the camera feed, mirrored. Falls back to the video. */
  webcam?: boolean;
  onWebcamError?: (error: Error) => void;
  /** Color of the metal. White gives plain steel. */
  tint?: string;
  /** How strongly the surface mirrors the scene, 0–1. At 0 it turns matte. */
  metalness?: number;
  /** Brushed grain, 0–1. Stretches reflections along the grain. */
  roughness?: number;
  /** Blur of the reflection, in px. */
  blurStrength?: number;
  /** Removes color from the reflection, 0–1. */
  grayscale?: number;
  /** Gentle bends in the surface that ripple the reflection. */
  warp?: number;
  /** Size of the bends. */
  warpScale?: number;
  /** Brightness of the light band that sweeps across the card as it tilts. */
  shine?: number;
  /** Width of the polished edge that catches the light, in px. */
  bevel?: number;
  /** Strength of the light that follows the cursor, 0–1. */
  glare?: number;
  /** Tilts the card toward the cursor. */
  enableTilt?: boolean;
  /** Largest tilt angle, in degrees. */
  tiltStrength?: number;
  /** Fades the card in and sweeps the light across it once. */
  intro?: boolean;
  /** Numbers are px; strings are any CSS length. */
  width?: number | string;
  height?: number | string;
  /** Corner radius, in px. */
  radius?: number;
  className?: string;
  style?: CSSProperties;
};

declare const ReflectiveCard: (props: ReflectiveCardProps) => JSX.Element;

export default ReflectiveCard;
