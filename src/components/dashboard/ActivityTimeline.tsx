import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import { Activity, Sprout, CloudRain, Microscope, Wallet } from "lucide-react";
import { T } from "@/components/i18n/LanguageProvider";

export type ActivityItem = {
  icon: "crop" | "weather" | "disease" | "expense";
  title: React.ReactNode;
  time: string;
};

const iconMap = {
  crop: { Icon: Sprout, tint: "bg-af-primary/10 text-af-primary-deep" },
  weather: { Icon: CloudRain, tint: "bg-af-ai/10 text-af-ai" },
  disease: { Icon: Microscope, tint: "bg-af-amber/10 text-af-amber-ink" },
  expense: { Icon: Wallet, tint: "bg-af-sage text-af-secondary" },
};

export default function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-6">
      <SectionHeader title={<T k="activityTimeline.title" />} icon={<Activity className="w-4 h-4" />} />
      <ol className="relative mt-2">
        {/* connector line */}
        <span className="absolute left-[15px] top-2 bottom-2 w-px bg-af-border" />
        {items.map((it, i) => {
          const { Icon, tint } = iconMap[it.icon];
          return (
            <li key={i} className="relative flex items-start gap-3 py-2.5">
              <span className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-af-card ${tint}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0 pt-1">
                <div className="text-sm font-semibold text-af-ink leading-tight">{it.title}</div>
                <div className="text-[11px] text-af-muted mt-0.5">{it.time}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
