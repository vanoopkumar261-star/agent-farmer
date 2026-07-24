"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient background: drifting aurora blobs (with gentle scroll parallax),
 * faint topographic contour lines, a dot grid and film grain.
 * All movement is GPU-light and disabled under prefers-reduced-motion.
 */
export default function AppBackground() {
  const auroraRef = useRef<HTMLDivElement>(null);
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (auroraRef.current) auroraRef.current.style.transform = `translate3d(0, ${y * 0.06}px, 0)`;
        if (topoRef.current) topoRef.current.style.transform = `translate3d(0, ${y * -0.03}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Drifting aurora blobs */}
      <div ref={auroraRef} className="absolute inset-0 will-change-transform">
        <div className="absolute -top-40 -left-32 h-[460px] w-[460px] rounded-full bg-af-primary/[0.07] blur-[130px] animate-af-drift" />
        <div className="absolute -top-20 right-[-6rem] h-[400px] w-[400px] rounded-full bg-af-ai/[0.06] blur-[130px] animate-af-drift-2" />
        <div className="absolute top-1/3 left-1/2 h-[380px] w-[380px] rounded-full bg-af-leaf/[0.05] blur-[140px] animate-af-drift" style={{ animationDelay: "-8s" }} />
      </div>

      {/* Topographic contour lines */}
      <div ref={topoRef} className="absolute inset-0 will-change-transform">
        <TopoContours className="absolute -top-24 -left-24 w-[560px] h-[560px] text-af-ink opacity-[0.04]" />
        <TopoContours className="absolute bottom-[-8rem] right-[-6rem] w-[640px] h-[640px] text-af-secondary opacity-[0.05] rotate-180" />
      </div>

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(rgba(27,27,27,0.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 75%)",
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

/** Concentric organic contour rings — reads as an elevation/field map. */
function TopoContours({ className = "" }: { className?: string }) {
  const blob =
    "M300,110 C400,95 470,170 475,265 C480,360 415,440 315,455 C215,470 130,410 118,310 C106,210 200,125 300,110 Z";
  const rings = [1, 0.82, 0.64, 0.46, 0.3];
  return (
    <svg viewBox="0 0 600 600" fill="none" className={className}>
      {rings.map((s, i) => (
        <path
          key={i}
          d={blob}
          transform={`translate(300 283) scale(${s}) translate(-300 -283)`}
          stroke="currentColor"
          strokeWidth={1.4}
        />
      ))}
    </svg>
  );
}
