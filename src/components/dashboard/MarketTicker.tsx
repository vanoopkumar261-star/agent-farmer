import { TrendingUp, TrendingDown } from "lucide-react";

type Tick = { crop: string; price: number; change: number };

// Fallback only — the dashboard passes real prices via the `ticks` prop.
const FALLBACK_TICKS: Tick[] = [
  { crop: "Paddy", price: 2360, change: 2.4 },
  { crop: "Wheat", price: 2285, change: -0.8 },
  { crop: "Maize", price: 2010, change: 1.1 },
  { crop: "Cotton", price: 7120, change: 3.2 },
  { crop: "Soybean", price: 4680, change: -1.4 },
  { crop: "Sugarcane", price: 340, change: 0.5 },
  { crop: "Groundnut", price: 6250, change: 1.9 },
];

function Row({ t }: { t: Tick }) {
  const up = t.change >= 0;
  return (
    <span className="inline-flex items-center gap-2 px-5">
      <span className="text-sm font-semibold text-af-ink">{t.crop}</span>
      <span className="font-mono text-sm text-af-ink-2">₹{t.price.toLocaleString()}</span>
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-af-primary-deep" : "text-af-danger"}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? "+" : ""}
        {t.change}%
      </span>
      <span className="text-af-border">•</span>
    </span>
  );
}

export default function MarketTicker({ ticks }: { ticks?: Tick[] }) {
  const data = ticks && ticks.length ? ticks : FALLBACK_TICKS;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-af-card border border-af-border shadow-af-sm">
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 bg-af-secondary text-white px-4 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-af-primary animate-pulse" />
        Mandi
      </div>
      <div className="py-3 pl-[92px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-af-ticker whitespace-nowrap">
          {[...data, ...data].map((t, i) => (
            <Row key={i} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
