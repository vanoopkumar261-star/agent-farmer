"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CloudRain, Sparkles, Bug, Check } from "lucide-react";

const notifications = [
  { icon: CloudRain, tint: "bg-af-ai/10 text-af-ai", title: "Rain expected in 3 days", time: "2h ago" },
  { icon: Sparkles, tint: "bg-af-primary/10 text-af-primary-deep", title: "Paddy is tracking on schedule", time: "5h ago" },
  { icon: Bug, tint: "bg-af-amber/12 text-[#9a7100]", title: "Weekly disease scan reminder", time: "1d ago" },
];

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-[10px] border border-af-border bg-af-card text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 transition"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-af-danger ring-2 ring-af-card" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-af-card border border-af-border shadow-af-float overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-af-border">
            <span className="text-sm font-bold text-af-ink">Notifications</span>
            <button className="inline-flex items-center gap-1 text-[11px] font-bold text-af-primary-deep hover:underline">
              <Check className="w-3 h-3" /> Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-auto">
            {notifications.map((n, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-af-bg transition cursor-pointer">
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${n.tint}`}>
                  <n.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-af-ink leading-snug">{n.title}</div>
                  <div className="text-[11px] text-af-muted mt-0.5">{n.time}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2.5 border-t border-af-border text-center">
            <button className="text-[13px] font-bold text-af-primary-deep hover:underline">View all</button>
          </div>
        </div>
      )}
    </div>
  );
}
