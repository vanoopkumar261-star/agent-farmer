import { CheckCircle2, Circle } from "lucide-react";

export type Task = {
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

export default function TasksCard({ tasks }: { tasks: Task[] }) {
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-af-muted">
          Today&apos;s Tasks
        </span>
        <span className="font-mono text-[11px] font-bold text-af-ink-2">
          {doneCount}/{tasks.length}
        </span>
      </div>

      <ul className="space-y-1">
        {tasks.map((t, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-af-bg transition"
          >
            {t.done ? (
              <CheckCircle2 className={`w-5 h-5 shrink-0 ${toneMap[t.tone]}`} />
            ) : (
              <Circle className="w-5 h-5 shrink-0 text-af-border" />
            )}
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold ${
                  t.done ? "text-af-muted line-through" : "text-af-ink"
                }`}
              >
                {t.title}
              </div>
              <div className="text-[11px] text-af-muted">{t.meta}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
