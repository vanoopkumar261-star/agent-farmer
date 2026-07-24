"use client";

import { useEffect } from "react";

/**
 * One document-level listener that drives the cursor-follow spotlight on any
 * element carrying the `.af-spotlight` class. Cheap: a single closest() +
 * two setProperty calls per move. No-op under reduced-motion.
 */
export default function SpotlightLayer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.(".af-spotlight") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
