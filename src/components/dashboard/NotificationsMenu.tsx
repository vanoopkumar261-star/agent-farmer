"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CloudRain, Sparkles, Bug, Check, AlertTriangle, ListChecks, TrendingUp } from "lucide-react";
import { loadNotifications, markAllRead, type NotificationRow } from "@/lib/notifications";

const KIND: Record<string, { icon: any; tint: string }> = {
  weather: { icon: CloudRain, tint: "bg-af-ai/10 text-af-ai" },
  critical: { icon: AlertTriangle, tint: "bg-af-danger/10 text-af-danger" },
  task: { icon: ListChecks, tint: "bg-af-primary/10 text-af-primary-deep" },
  disease: { icon: Bug, tint: "bg-af-amber/10 text-af-amber-ink" },
  market: { icon: TrendingUp, tint: "bg-af-primary/10 text-af-primary-deep" },
  info: { icon: Sparkles, tint: "bg-af-ai/10 text-af-ai" },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function NotificationsMenu({ farmerId }: { farmerId?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (farmerId) loadNotifications(farmerId).then(setItems);
  }, [farmerId]);

  const unread = items.filter((n) => !n.read).length;

  const onMarkAll = async () => {
    if (!farmerId) return;
    await markAllRead(farmerId);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-[10px] border border-af-border bg-af-card text-af-ink-2 hover:text-af-ink hover:border-af-primary/30 transition"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-af-danger ring-2 ring-af-card" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-af-card border border-af-border shadow-af-float overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-af-border">
            <span className="text-sm font-semibold text-af-ink">
              Notifications{unread > 0 ? ` (${unread})` : ""}
            </span>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-primary-deep hover:underline"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-af-muted">
              You&apos;re all caught up — no notifications.
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {items.map((n) => {
                const cfg = KIND[n.kind] ?? KIND.info;
                const Icon = cfg.icon;
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 transition ${
                      n.read ? "opacity-60" : "bg-af-primary/[0.03]"
                    }`}
                  >
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${cfg.tint}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-af-ink leading-snug">{n.title}</div>
                      {n.body && <div className="text-[12px] text-af-ink-2 mt-0.5 leading-snug">{n.body}</div>}
                      <div className="text-[11px] text-af-muted mt-0.5">{relTime(n.created_at)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-4 py-2.5 border-t border-af-border text-center">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-meta font-semibold text-af-primary-deep hover:underline"
            >
              View dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
