import "server-only";
import { createSupabaseServer } from "./supabase-server";
import type { TaskSeed } from "./agronomy";

/**
 * Server-side task bookkeeping — the memory that makes "you missed 2 of 5 tasks
 * yesterday" possible.
 *
 * The task list is *derived* from crop stage and weather, so it is never stored
 * anywhere by default. That means yesterday's list is gone the moment the day
 * turns, and there is nothing to compare against. `recordDayTasks` writes each
 * day's generated list as `open` rows so the day leaves a trace; ticking a task
 * flips its row to `done` (see lib/tasks.ts).
 *
 * Both helpers no-op if migrations 004/010 aren't applied.
 */

/** Local calendar day as yyyy-mm-dd. Mirrors todayKey() in lib/tasks.ts. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function serverToday(): string {
  return dayKey(new Date());
}

export function serverYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/**
 * Records today's generated tasks as `open`, once.
 *
 * `ignoreDuplicates` is essential: this runs on every dashboard render, and a
 * plain upsert would reset a task the farmer already ticked back to `open`.
 */
export async function recordDayTasks(
  farmerId: string,
  tasks: TaskSeed[],
  day: string = serverToday()
): Promise<void> {
  if (!tasks.length) return;
  try {
    const supabase = createSupabaseServer();
    const rows = tasks.map((t) => ({
      farmer_id: farmerId,
      task_key: t.key,
      title: t.title,
      meta: t.meta,
      tone: t.tone,
      category: t.category,
      status: "open",
      due_date: day,
    }));
    await supabase.from("farm_tasks").upsert(rows, {
      onConflict: "farmer_id,task_key,due_date",
      ignoreDuplicates: true,
    });
  } catch {
    /* table may not exist yet — no-op */
  }
}

export type DayTaskTally = { total: number; done: number; missed: number };

/** How many of a given day's tasks were completed. Zeroes when nothing is recorded. */
export async function tallyDayTasks(
  farmerId: string,
  day: string
): Promise<DayTaskTally> {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("farm_tasks")
      .select("status")
      .eq("farmer_id", farmerId)
      .eq("due_date", day);
    if (error || !data) return { total: 0, done: 0, missed: 0 };
    const total = data.length;
    const done = data.filter((r: any) => r.status === "done").length;
    return { total, done, missed: total - done };
  } catch {
    return { total: 0, done: 0, missed: 0 };
  }
}
