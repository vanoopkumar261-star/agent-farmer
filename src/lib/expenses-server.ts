import "server-only";
import { createSupabaseServer } from "./supabase-server";
import type { Txn, ExpensesData } from "./expenses";

/**
 * Loads and aggregates a farmer's income/expense ledger. Scoped to farmerId
 * (RLS also enforces ownership via the signed-in session).
 */
export async function getExpensesData(farmerId: string): Promise<ExpensesData> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("farm_expenses")
    .select("*")
    .eq("farmer_id", farmerId)
    .order("txn_date", { ascending: false });

  if (error) console.error("EXPENSES fetch error:", error);
  const txns = (data ?? []) as Txn[];

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap: Record<string, number> = {};
  const monthMap: Record<string, { income: number; expense: number }> = {};

  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    if (t.kind === "income") totalIncome += amt;
    else {
      totalExpense += amt;
      catMap[t.category] = (catMap[t.category] ?? 0) + amt;
    }
    const m = t.txn_date?.slice(0, 7) ?? "—"; // YYYY-MM
    if (!monthMap[m]) monthMap[m] = { income: 0, expense: 0 };
    if (t.kind === "income") monthMap[m].income += amt;
    else monthMap[m].expense += amt;
  }

  const byCategory = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
      income: v.income,
      expense: v.expense,
    }));

  return {
    txns,
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    byCategory,
    byMonth,
  };
}
