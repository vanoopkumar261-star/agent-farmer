import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/** Small ▲/▼ delta pill. `positiveIsGood` flips color semantics (e.g. expenses). */
export default function TrendDelta({
  value,
  positiveIsGood = true,
  className = "",
}: {
  value: number; // percent, e.g. 12 or -4
  positiveIsGood?: boolean;
  className?: string;
}) {
  const up = value > 0;
  const flat = value === 0;
  const good = flat ? true : up === positiveIsGood;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const color = flat
    ? "text-af-muted bg-af-neutral/10"
    : good
    ? "text-af-primary-deep bg-af-primary/10"
    : "text-af-danger bg-af-danger/10";

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${color} ${className}`}>
      <Icon className="w-3 h-3" />
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}
