import { Sparkles, ArrowRight } from "lucide-react";
import Sheen from "@/components/ui/Sheen";

export default function AiSummaryCard({ points }: { points: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
      {/* soft accent */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-af-primary/25 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-af-ai/20 blur-2xl" />
      <Sheen />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
          <Sparkles className="w-3.5 h-3.5 text-af-primary" />
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-white/90">
            AI Daily Summary
          </span>
        </div>

        <ul className="mt-4 space-y-2.5">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-white/90">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-af-primary shrink-0" />
              {p}
            </li>
          ))}
        </ul>

        <button className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-af-primary hover:gap-2.5 transition-all">
          Ask the AI Assistant
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
