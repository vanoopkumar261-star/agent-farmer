import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";
import { T } from "@/components/i18n/LanguageProvider";

/**
 * Doorway from the dashboard into the Jaivik Sathi eLibrary.
 *
 * The library is shared between the public Jaivik Sathi site and the farmer
 * app, and its own back button points at the marketing landing page. Passing
 * `from` tells it where this farmer actually came from, so "back" returns them
 * to the page they left instead of dropping them outside the app.
 */
export default function LibraryCard({ from = "/dashboard" }: { from?: string }) {
  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-sage text-af-secondary">
          <Library className="w-4 h-4" />
        </span>
        <div>
          <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-af-muted">
            <T k="libraryCard.label" />
          </span>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
            <T k="libraryCard.title" />
          </h2>
        </div>
      </div>

      <p className="mt-3 text-meta text-af-ink-2 leading-relaxed">
        <T k="libraryCard.body" />
      </p>

      <Link
        href={`/jaivik-sathi/library?from=${encodeURIComponent(from)}`}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-bold transition active:scale-[0.98] shadow-af-md outline-none focus-visible:ring-2 focus-visible:ring-af-primary/40"
      >
        <T k="libraryCard.cta" />
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
