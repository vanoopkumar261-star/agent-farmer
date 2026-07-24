"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, Txn } from "@/lib/expenses";
import Card from "@/components/ui/Card";
import { Plus, Trash2, ArrowDownRight, ArrowUpRight, Loader2, Receipt } from "lucide-react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function TransactionPanel({
  farmerId,
  txns,
}: {
  farmerId: string;
  txns: Txn[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cats = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function switchKind(k: "expense" | "income") {
    setKind(k);
    setCategory((k === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0]);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!desc.trim() || !amt || amt <= 0) return;
    setSaving(true);
    const { error } = await supabase.from("farm_expenses").insert([
      {
        farmer_id: farmerId,
        kind,
        category,
        item_name: desc.trim(),
        amount: amt,
        txn_date: date,
      },
    ]);
    setSaving(false);
    if (error) {
      alert("Could not save transaction.");
      return;
    }
    setDesc("");
    setAmount("");
    router.refresh();
  }

  async function remove(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("farm_expenses").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert("Could not delete.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
      {/* Add form */}
      <Card className="p-6 h-fit">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
            <Plus className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-extrabold text-af-ink">Add Transaction</h2>
        </div>

        <form onSubmit={add} className="space-y-4">
          {/* kind toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-[12px] bg-af-bg border border-af-border p-1">
            <button
              type="button"
              onClick={() => switchKind("expense")}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-sm font-bold transition ${
                kind === "expense" ? "bg-af-card text-af-danger shadow-af-sm" : "text-af-muted"
              }`}
            >
              <ArrowDownRight className="w-4 h-4" /> Expense
            </button>
            <button
              type="button"
              onClick={() => switchKind("income")}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-sm font-bold transition ${
                kind === "income" ? "bg-af-card text-af-primary-deep shadow-af-sm" : "text-af-muted"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Income
            </button>
          </div>

          <Labeled label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
            >
              {cats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Labeled>

          <Labeled label="Description">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. DAP fertilizer"
              className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
            />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Amount (₹)">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
              />
            </Labeled>
            <Labeled label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
              />
            </Labeled>
          </div>

          <button
            type="submit"
            disabled={saving || !desc.trim() || !Number(amount)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-bold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add {kind === "expense" ? "Expense" : "Income"}
          </button>
        </form>
      </Card>

      {/* List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
              <Receipt className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-extrabold text-af-ink">Ledger</h2>
          </div>
          <span className="font-mono text-[11px] font-bold text-af-muted">{txns.length} entries</span>
        </div>

        {txns.length === 0 ? (
          <div className="py-12 text-center text-sm text-af-muted">
            No transactions yet — add your first on the left.
          </div>
        ) : (
          <ul className="divide-y divide-af-border max-h-[460px] overflow-auto -mr-1 pr-1">
            {txns.map((t) => {
              const income = t.kind === "income";
              return (
                <li key={t.id} className="group flex items-center gap-3 py-3">
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                      income ? "bg-af-primary/10 text-af-primary-deep" : "bg-af-amber/12 text-[#9a7100]"
                    }`}
                  >
                    {income ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-af-ink truncate">{t.item_name}</div>
                    <div className="text-[11px] text-af-muted">
                      {t.category} · {t.txn_date}
                    </div>
                  </div>
                  <div className={`font-mono text-sm font-bold ${income ? "text-af-primary-deep" : "text-af-ink"}`}>
                    {income ? "+" : "−"}
                    {rupee(t.amount)}
                  </div>
                  <button
                    onClick={() => remove(t.id)}
                    disabled={deletingId === t.id}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-lg text-af-muted hover:text-af-danger hover:bg-af-danger/8 transition"
                  >
                    {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
