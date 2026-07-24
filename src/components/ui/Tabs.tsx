"use client";

/** Lightweight segmented tab control. */
export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[12px] bg-af-bg border border-af-border p-1">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-1.5 rounded-[9px] text-[13px] font-bold transition-all ${
              isActive
                ? "bg-af-card text-af-ink shadow-af-sm"
                : "text-af-muted hover:text-af-ink-2"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
