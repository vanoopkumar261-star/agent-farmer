"use client";

import React from "react";

type TerminalWindowProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: "green" | "blue";
};

export default function TerminalWindow({
  title,
  children,
  className = "",
  accent = "green",
}: TerminalWindowProps) {
  const glow = accent === "green" ? "shadow-hud-glow-green" : "shadow-hud-glow-blue";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#050b09]/85 backdrop-blur-xl border border-hud-border ${glow} ${className}`}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-hud-border px-4 py-3 bg-white/[0.03]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-hud-red/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-hud-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-hud-green/70" />
        </div>
        <span className="ml-2 font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-hud-text-faint truncate">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="relative p-5">{children}</div>
    </div>
  );
}
