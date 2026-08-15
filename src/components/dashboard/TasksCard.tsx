"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { persistTaskDone, loadDoneKeys } from "@/lib/tasks";

export type Task = {
  key?: string;
  title: string;
  meta: string;
  done: boolean;
  tone: "green" | "amber" | "blue";
};

const toneMap = {
  green: "text-af-primary",
  amber: "text-af-amber",
  blue: "text-af-ai",
};

export default function TasksCard({ tasks, farmerId }: { tasks: Task[]; farmerId?: string }) {
  const keyOf = (t: Task, i: number) => t.key ?? String(i);

  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tasks.map((t, i) => [keyOf(t, i), t.done]))
  );

  // Merge any persisted completions once on mount (no-op before migration 004).
  useEffect(() => {
    if (!farmerId) return;
    let active = true;
    loadDoneKeys(farmerId).then((keys) => {
      if (!active || keys.size === 0) return;
      setDone((prev) => {
        const next = { ...prev };
        tasks.forEach((t, i) => {
          const k = keyOf(t, i);
          if (keys.has(k)) next[k] = true;
        });
        return next;
      });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmerId]);

  const toggle = (t: Task, i: number) => {
    const k = keyOf(t, i);
    const nextDone = !done[k];
    setDone((prev) => ({ ...prev, [k]: nextDone }));
    // Durable once the farm_tasks table exists; a silent no-op before then.
    if (farmerId && t.key) persistTaskDone(farmerId, { key: t.key, title: t.title, meta: t.meta, tone: t.tone }, nextDone);
  };

  const doneCount = tasks.filter((t, i) => done[keyOf(t, i)]).length;

  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-af-muted">
          Today&apos;s Tasks
        </span>
        <span className="font-mono text-[11px] font-semibold text-af-ink-2">
          {doneCount}/{tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="text-sm text-af-muted">No tasks right now — you&apos;re all caught up.</div>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t, i) => {
            const isDone = done[keyOf(t, i)];
            return (
              <li key={keyOf(t, i)}>
                <button
                  onClick={() => toggle(t, i)}
                  className="w-full flex items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-af-bg transition"
                >
                  {isDone ? (
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${toneMap[t.tone]}`} />
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 text-af-border" />
                  )}
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold ${
                        isDone ? "text-af-muted line-through" : "text-af-ink"
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-[11px] text-af-muted">{t.meta}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
