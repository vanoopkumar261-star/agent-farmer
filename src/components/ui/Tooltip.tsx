"use client";

import React from "react";

/** Minimal CSS hover tooltip — no dependency. */
export default function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const pos =
    side === "top"
      ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
      : "top-full mt-2 left-1/2 -translate-x-1/2";
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={`pointer-events-none absolute ${pos} z-50 whitespace-nowrap rounded-lg bg-af-ink px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 shadow-af-md`}
      >
        {label}
      </span>
    </span>
  );
}
