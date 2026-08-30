import { getDashboardData } from "@/lib/dashboard";
import { getExpensesData } from "@/lib/expenses-server";
import ExpenseCharts from "@/components/dashboard/ExpenseCharts";
import TransactionPanel from "@/components/dashboard/TransactionPanel";
import StatTile from "@/components/dashboard/StatTile";
import Reveal from "@/components/ui/Reveal";
import { T } from "@/components/i18n/LanguageProvider";
import { Wallet, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import Link from "next/link";
import { STATUS, SERIES } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { farmer } = await getDashboardData();

  if (!farmer) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center rounded-2xl bg-af-card border border-af-border shadow-af-sm p-10">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-af-ink"><T k="expenses.noProfileTitle" /></h2>
        <p className="mt-2 text-sm text-af-ink-2"><T k="expenses.noProfileBody" /></p>
        <Link href="/onboarding" className="mt-6 inline-flex rounded-[14px] bg-af-primary text-white px-6 py-3 text-sm font-semibold">
          <T k="dashboard.home.startOnboarding" />
        </Link>
      </div>
    );
  }

  const data = await getExpensesData(farmer.id);
  const margin = data.totalIncome > 0 ? Math.round((data.profit / data.totalIncome) * 100) : 0;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <Wallet className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-heading font-semibold text-af-ink"><T k="title.expenses" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2"><T k="expenses.subtitle" /></p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Reveal index={0}>
          <StatTile
            icon={<TrendingUp className="w-[18px] h-[18px]" />}
            label={<T k="expenses.stat.totalIncome" />}
            value={data.totalIncome}
            prefix="₹"
            spark={[0, 22, 22, 27, 27, 45]}
          />
        </Reveal>
        <Reveal index={1}>
          <StatTile
            icon={<TrendingDown className="w-[18px] h-[18px]" />}
            label={<T k="expenses.stat.totalExpenses" />}
            value={data.totalExpense}
            prefix="₹"
            sparkColor={SERIES.expense}
            spark={[4, 11, 19, 21, 27, 33]}
          />
        </Reveal>
        <Reveal index={2}>
          <StatTile
            icon={<Landmark className="w-[18px] h-[18px]" />}
            label={<T k="expenses.stat.netProfit" />}
            value={data.profit}
            prefix="₹"
            delta={margin}
            sparkColor={data.profit >= 0 ? STATUS.up : STATUS.down}
            spark={[-4, -9, 3, 6, 0, data.profit / 1000]}
          />
        </Reveal>
      </div>

      {/* Charts */}
      <div className="mt-6">
        <Reveal>
          <ExpenseCharts byCategory={data.byCategory} byMonth={data.byMonth} />
        </Reveal>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <Reveal>
          <TransactionPanel farmerId={farmer.id} txns={data.txns} />
        </Reveal>
      </div>
    </div>
  );
}
