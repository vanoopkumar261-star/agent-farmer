"use client";

import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";

/**
 * Site-wide smooth (inertial) scrolling via Lenis. Wrap a page's content in
 * this to get weighted wheel scrolling and smooth anchor jumps. Respects
 * prefers-reduced-motion by falling back to native scroll.
 *
 * `anchors` handles same-page #hash links; the offset clears the fixed nav.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <ReactLenis
      root
      options={{
        lerp: prefersReduced ? 1 : 0.1,
        smoothWheel: !prefersReduced,
        wheelMultiplier: 1,
        anchors: { offset: -90 },
      }}
    >
      {children}
    </ReactLenis>
  );
}
