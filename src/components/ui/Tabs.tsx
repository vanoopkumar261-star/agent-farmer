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
    <div className="flex w-full items-center gap-1 overflow-x-auto rounded-[12px] bg-af-bg border border-af-border p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:inline-flex">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-1.5 rounded-[9px] text-meta font-semibold transition-all ${
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
