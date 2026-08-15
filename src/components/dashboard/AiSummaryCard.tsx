import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";

/**
 * Daily Farm Summary — light card with the field photograph bleeding in from
 * the right and fading out under the text via a horizontal mask, so the copy
 * stays fully legible without an overlay scrim.
 */
export default function AiSummaryCard({ points }: { points: string[] }) {
  return (
    <Card className="overflow-hidden min-h-[230px]">
      {/* Photograph, masked so it dissolves into the card before reaching the copy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/bg-field-mist.png')",
          maskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.25) 28%, rgba(0,0,0,0.85) 62%, #000 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.25) 28%, rgba(0,0,0,0.85) 62%, #000 100%)",
        }}
      />
      {/* Warm sunrise glow, echoing the beige in the palette. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 right-8 h-40 w-40 rounded-full bg-af-beige/70 blur-3xl"
      />

      <div className="relative z-10 p-6 max-w-[58%]">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">Daily Farm Summary</h2>

        <ul className="mt-4 space-y-2.5">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-af-ink-2">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-af-primary shrink-0" />
              {p}
            </li>
          ))}
        </ul>

        <Link
          href="/dashboard/assistant"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-af-primary-deep hover:gap-2.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40 rounded"
        >
          Ask the AI Assistant
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Card>
  );
}
