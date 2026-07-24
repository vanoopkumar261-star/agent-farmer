import { AlertTriangle, CloudRain, Bug, Sparkles } from "lucide-react";

export type Alert = {
  kind: "weather" | "disease" | "ai" | "critical";
  title: string;
  body: string;
};

const config = {
  weather: { icon: CloudRain, ring: "border-af-primary/25", tint: "bg-af-primary/8", color: "text-af-primary-deep" },
  ai: { icon: Sparkles, ring: "border-af-ai/25", tint: "bg-af-ai/8", color: "text-af-ai" },
  disease: { icon: Bug, ring: "border-af-amber/30", tint: "bg-af-amber/10", color: "text-af-amber" },
  critical: { icon: AlertTriangle, ring: "border-af-danger/30", tint: "bg-af-danger/8", color: "text-af-danger" },
};

export default function AlertsCard({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
      <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-af-muted">
        Alerts
      </span>

      <div className="mt-4 space-y-3">
        {alerts.length === 0 && (
          <div className="text-sm text-af-muted">All clear — no active alerts.</div>
        )}
        {alerts.map((a, i) => {
          const c = config[a.kind];
          const Icon = c.icon;
          return (
            <div key={i} className={`flex items-start gap-3 rounded-xl border ${c.ring} ${c.tint} px-3.5 py-3`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${c.color}`} />
              <div>
                <div className="text-sm font-bold text-af-ink leading-tight">{a.title}</div>
                <div className="text-[12px] text-af-ink-2 mt-0.5 leading-relaxed">{a.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
