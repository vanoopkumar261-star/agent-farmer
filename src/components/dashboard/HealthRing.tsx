"use client";

type HealthRingProps = {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  label?: string;
};

export default function HealthRing({ value, size = 132, stroke = 12, label }: HealthRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c - (clamped / 100) * c;

  // currentColor keeps the ring on the shell's scoped af-* palette.
  const tone = clamped >= 75 ? "text-af-primary" : clamped >= 50 ? "text-af-amber" : "text-af-danger";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          className="text-af-sage"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={tone}
          stroke="currentColor"
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[38px] font-semibold text-af-ink leading-none">{clamped}</span>
        {label && <span className="mt-1 text-meta font-semibold text-af-muted">{label}</span>}
      </div>
    </div>
  );
}
