// Client-safe types + constants shared by the expense UI and the server query.
// The Supabase-backed reader lives in ./expenses-server (server-only).

export type Txn = {
  id: string;
  farmer_id: string | null;
  kind: "expense" | "income";
  category: string;
  item_name: string;
  amount: number;
  txn_date: string;
  created_at: string | null;
};

export const EXPENSE_CATEGORIES = [
  "Seeds",
  "Fertilizer",
  "Pesticide",
  "Labor",
  "Machinery",
  "Irrigation",
  "Transport",
  "Other",
];

export const INCOME_CATEGORIES = ["Crop Sale", "Subsidy", "Other"];

export type ExpensesData = {
  txns: Txn[];
  totalIncome: number;
  totalExpense: number;
  profit: number;
  byCategory: { category: string; amount: number }[];
  byMonth: { month: string; income: number; expense: number }[];
};

