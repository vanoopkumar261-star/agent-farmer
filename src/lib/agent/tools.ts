"use client";

import { supabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/expenses";
import { recordAction, markUndone, lastUndoable } from "./log";

/**
 * Runs a tool call that /api/agent/turn asked for.
 *
 * This is the ONLY place a voice-originated write actually happens, and that
 * is a security property, not an implementation detail. The gateway never
 * touches the database and never sees a farm UUID (see its own docstring) —
 * it only decides *which* tool with *which* farmer-facing arguments. The write
 * goes through the browser's own RLS-scoped Supabase session, exactly like the
 * manual form in TransactionPanel does.
 *
 * So a model hallucinating a tool call cannot write to data the farmer does
 * not own, and cannot bypass RLS. The worst it can do is ask for a tool call
 * with bad arguments — which is why every argument is re-validated here rather
 * than trusted, even though the schema it was given said not to send them.
 */

export type ToolCall = { name: string; args: Record<string, unknown> };
export type ToolResult =
  | { ok: true; summary: string; spoken: string }
  | { ok: false; reason: string };

type T = (key: string, params?: Record<string, string | number>) => string;

export async function executeToolCall(
  call: ToolCall,
  farmerId: string | null,
  t: T
): Promise<ToolResult> {
  switch (call.name) {
    case "log_expense":
      return logExpense(call.args, farmerId, t);
    default:
      return { ok: false, reason: t("agent.errorGeneric") };
  }
}

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

async function logExpense(
  args: Record<string, unknown>,
  farmerId: string | null,
  t: T
): Promise<ToolResult> {
  if (!farmerId) return { ok: false, reason: t("agent.errorNoProfile") };

  // Re-validation, not decoration. Each of these has been seen to come back
  // wrong from a model that was given an enum and a type.
  const kind = args.kind === "income" ? "income" : args.kind === "expense" ? "expense" : null;
  const amount =
    typeof args.amount === "number" && Number.isFinite(args.amount) && args.amount > 0
      ? args.amount
      : null;
  const itemName =
    typeof args.item_name === "string" && args.item_name.trim()
      ? args.item_name.trim().slice(0, 80)
      : null;
  if (!kind || !amount || !itemName) return { ok: false, reason: t("agent.errorGeneric") };

  const valid = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const requested = typeof args.category === "string" ? args.category : "";
  const category = valid.includes(requested) ? requested : "Other";

  const { data, error } = await supabase
    .from("farm_expenses")
    .insert([
      {
        farmer_id: farmerId,
        kind,
        category,
        item_name: itemName,
        amount,
        txn_date: new Date().toISOString().slice(0, 10),
      },
    ])
    .select("id")
    .single();

  if (error || !data?.id) return { ok: false, reason: t("agent.errorSaveFailed") };

  await recordAction({
    farmerId,
    tool: "log_expense",
    args: { kind, category, itemName, amount },
    summary: `${category} — ${rupees(amount)}`,
    inverse: { tool: "delete_expense", args: { id: data.id } },
  });

  return {
    ok: true,
    summary: `${category} — ${rupees(amount)}`,
    // What the assistant says out loud. Deliberately repeats the amount and
    // the category back: a farmer who did not look at the screen needs to hear
    // what was recorded, so a mis-heard number is caught immediately rather
    // than at month end.
    spoken:
      kind === "income"
        ? t("agent.spokenIncomeSaved", { amount: rupees(amount), category })
        : t("agent.spokenExpenseSaved", { amount: rupees(amount), category }),
  };
}

/**
 * Executes the inverse of the most recent undoable action.
 *
 * Reads the local ring rather than the database: the point of undo is to take
 * back the thing that just happened, and that has to work even when the
 * durable mirror never got written.
 */
export async function undoLastAction(t: T): Promise<ToolResult> {
  const entry = lastUndoable();
  if (!entry?.inverse) return { ok: false, reason: t("agent.nothingToUndo") };

  if (entry.inverse.tool === "delete_expense") {
    const id = entry.inverse.args.id;
    if (typeof id !== "string") return { ok: false, reason: t("agent.errorGeneric") };
    const { error } = await supabase.from("farm_expenses").delete().eq("id", id);
    if (error) return { ok: false, reason: t("agent.errorGeneric") };
    await markUndone(entry.id);
    return { ok: true, summary: entry.summary, spoken: t("agent.spokenUndone") };
  }

  return { ok: false, reason: t("agent.nothingToUndo") };
}
