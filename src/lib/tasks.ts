import { supabase } from "./supabase";

/**
 * Client-side persistence for interactive farm tasks. Backed by the farm_tasks
 * table (migrations 004 + 010). Everything here degrades gracefully: before the
 * migrations are applied the queries error and these helpers quietly report
 * "not persisted" so the UI stays interactive (session-only) instead of breaking.
 *
 * Completion is per DAY, not per task. Task keys come from the agronomy engine
 * and are stage-derived (`scout-early-<farmId>`), so the same key recurs every
 * day a stage lasts. Without a date, ticking "Inspect germination" once left it
 * ticked for the rest of the germination stage and the farmer was never asked
 * again. `due_date` is what separates today's copy from yesterday's.
 */

type PersistTask = { key: string; title: string; meta: string; tone: string };

/** Local calendar day as yyyy-mm-dd — the farmer's day, not UTC's. */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/** Upsert a task's completion state for a given day. True only if it persisted. */
export async function persistTaskDone(
  farmerId: string,
  task: PersistTask,
  done: boolean,
  day: string = todayKey()
): Promise<boolean> {
  try {
    const { error } = await supabase.from("farm_tasks").upsert(
      {
        farmer_id: farmerId,
        task_key: task.key,
        title: task.title,
        meta: task.meta,
        tone: task.tone,
        status: done ? "done" : "open",
        due_date: day,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "farmer_id,task_key,due_date" }
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Task keys the farmer completed on `day` (defaults to today). Scoping to the
 * day is the whole point — yesterday's ticks must not carry over.
 */
export async function loadDoneKeys(
  farmerId: string,
  day: string = todayKey()
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("farm_tasks")
      .select("task_key")
      .eq("farmer_id", farmerId)
      .eq("due_date", day)
      .eq("status", "done");
    if (error || !data) return new Set();
    return new Set(data.map((r: any) => r.task_key as string));
  } catch {
    return new Set();
  }
}
