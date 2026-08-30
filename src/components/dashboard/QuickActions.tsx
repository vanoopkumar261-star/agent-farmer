"use client";

import Link from "next/link";
import { Wallet, ScanLine, MessageSquare, TrendingUp } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";

export default function QuickActions() {
  const { t } = useT();
  const actions = [
    { icon: Wallet, label: t("quickActions.addExpense"), sub: t("quickActions.addExpenseSub"), href: "/dashboard/expenses", tint: "bg-af-primary/10 text-af-primary-deep" },
    { icon: ScanLine, label: t("quickActions.scanDisease"), sub: t("quickActions.scanDiseaseSub"), href: "/dashboard/disease", tint: "bg-af-amber/10 text-af-amber-ink" },
    { icon: MessageSquare, label: t("quickActions.askAI"), sub: t("quickActions.askAISub"), href: "/dashboard/assistant", tint: "bg-af-ai/10 text-af-ai" },
    { icon: TrendingUp, label: t("quickActions.marketPrices"), sub: t("quickActions.marketPricesSub"), href: "/dashboard/market", tint: "bg-af-sage text-af-secondary" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="af-spotlight group relative flex items-center gap-3 rounded-[16px] bg-af-card border border-af-border shadow-af-sm px-4 py-3.5 transition-all duration-200 ease-out hover:shadow-af-md hover:border-af-primary/25"
        >
          <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${a.tint}`}>
            <a.icon className="w-[18px] h-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-af-ink leading-tight">{a.label}</span>
            <span className="block mt-0.5 text-[12px] text-af-muted leading-tight truncate">{a.sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
