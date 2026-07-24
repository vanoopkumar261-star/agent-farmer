import Link from "next/link";
import { Wallet, ScanLine, MessageSquare, TrendingUp } from "lucide-react";

const actions = [
  { icon: Wallet, label: "Add Expense", href: "/dashboard/expenses", tint: "bg-af-primary/10 text-af-primary-deep" },
  { icon: ScanLine, label: "Scan Disease", href: "/dashboard/disease", tint: "bg-af-amber/12 text-[#9a7100]" },
  { icon: MessageSquare, label: "Ask AI", href: "/dashboard/assistant", tint: "bg-af-ai/10 text-af-ai" },
  { icon: TrendingUp, label: "Market Prices", href: "/dashboard/market", tint: "bg-af-sage text-af-secondary" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="af-spotlight group relative flex items-center gap-3 rounded-2xl bg-af-card border border-af-border shadow-af-sm px-4 py-3.5 transition-all duration-200 hover:shadow-af-md hover:-translate-y-0.5"
        >
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${a.tint}`}>
            <a.icon className="w-[18px] h-[18px]" />
          </span>
          <span className="text-sm font-bold text-af-ink">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
