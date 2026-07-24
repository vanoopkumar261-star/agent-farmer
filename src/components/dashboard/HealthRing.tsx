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

  const color = clamped >= 75 ? "#10B981" : clamped >= 50 ? "#F4B400" : "#D93025";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4E9E3" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-extrabold text-af-ink leading-none">{clamped}</span>
        {label && <span className="mt-1 text-[11px] font-semibold text-af-muted uppercase tracking-wide">{label}</span>}
      </div>
    </div>
  );
}
