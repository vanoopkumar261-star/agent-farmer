import React from "react";

type Tone = "primary" | "ai" | "amber" | "danger" | "neutral" | "sage";

const tones: Record<Tone, string> = {
  primary: "bg-af-primary/10 text-af-primary-deep",
  ai: "bg-af-ai/10 text-af-ai",
  amber: "bg-af-amber/10 text-af-amber-ink",
  danger: "bg-af-danger/10 text-af-danger",
  neutral: "bg-af-neutral/10 text-af-ink-2",
  sage: "bg-af-sage text-af-secondary",
};

export default function Badge({
  children,
  tone = "primary",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
