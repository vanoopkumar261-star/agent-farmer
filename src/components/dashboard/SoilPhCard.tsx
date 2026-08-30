import Link from "next/link";
import { FlaskConical, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { T } from "@/components/i18n/LanguageProvider";
import { relativeTime } from "@/lib/dashboard";
import { getRecentSoilReadings } from "@/lib/history";
import { phBand } from "@/lib/soilPh";
import Sparkline from "@/components/dashboard/Sparkline";

/** Latest soil-pH reading + mini trend, with a link to /dashboard/soil. */
export default async function SoilPhCard({ farmerId }: { farmerId: string }) {
  const readings = await getRecentSoilReadings(farmerId, 10);
  const latest = readings[0] ?? null;
  const band = latest ? phBand(latest.ph) : null;
  const trend = [...readings].reverse().map((r) => r.ph); // oldest -> newest

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">
            <FlaskConical className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              <T k="soilPh.cardTitle" />
            </h2>
            {latest && (
              <p className="text-[12px] text-af-muted">
                <T k="soilPh.measuredAgo" params={{ ago: relativeTime(latest.created_at) }} />
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/soil"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-af-primary-deep hover:underline shrink-0"
        >
          <T k="soilPh.updateLink" />
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {latest && band ? (
        <div className="mt-4 flex items-end gap-4">
          <div>
            <div className="text-4xl font-semibold tabular-nums leading-none" style={{ color: band.color }}>
              {latest.ph.toFixed(1)}
            </div>
            <div className="mt-1.5 text-[12px] font-semibold" style={{ color: band.color }}>
              <T k={`soilPh.band.${band.key}.label`} />
            </div>
          </div>
          {trend.length > 1 && (
            <div className="flex-1 min-w-0">
              <Sparkline data={trend} color={band.color} height={40} />
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/dashboard/soil"
          className="mt-4 flex items-center justify-between rounded-[14px] border border-dashed border-af-border bg-af-bg px-4 py-3 text-sm text-af-ink-2 hover:border-af-primary/40 transition"
        >
          <T k="soilPh.emptyCard" />
          <ArrowRight className="w-4 h-4 text-af-muted" />
        </Link>
      )}
    </Card>
  );
}
