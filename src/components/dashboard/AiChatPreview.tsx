import Link from "next/link";
import { Sparkles, ArrowRight, Send } from "lucide-react";

const suggestions = ["When should I irrigate?", "Best fertilizer for paddy?", "Show my expenses"];

export default function AiChatPreview() {
  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-ai/10 text-af-ai">
          <Sparkles className="w-4 h-4" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-af-ink leading-tight">AI Assistant</h2>
          <p className="text-[13px] text-af-muted">Memory-aware · knows your farm</p>
        </div>
      </div>

      {/* sample exchange */}
      <div className="space-y-2.5">
        <div className="max-w-[80%] ml-auto rounded-2xl rounded-br-sm bg-af-sage text-af-secondary px-3.5 py-2 text-[13px] font-medium">
          Is my paddy on track?
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-af-bg border border-af-border px-3.5 py-2 text-[13px] text-af-ink-2">
          Yes — Farm 1 is at day 1 of germination, tracking on schedule. Rain is expected in 3 days, so hold irrigation.
        </div>
      </div>

      {/* suggestion chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Link
            key={s}
            href="/dashboard/assistant"
            className="rounded-full bg-af-bg border border-af-border px-3 py-1.5 text-[12px] font-semibold text-af-ink-2 hover:border-af-ai/40 hover:text-af-ai transition"
          >
            {s}
          </Link>
        ))}
      </div>

      {/* faux input */}
      <Link
        href="/dashboard/assistant"
        className="mt-4 flex items-center justify-between gap-2 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-muted hover:border-af-ai/40 transition"
      >
        Ask anything about your farm…
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-af-ai text-white shrink-0">
          <Send className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}
