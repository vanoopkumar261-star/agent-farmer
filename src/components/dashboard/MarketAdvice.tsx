"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowUpRight, PauseCircle, Clock, PackageX } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useT } from "@/components/i18n/LanguageProvider";

type Rec = {
  crop: string;
  action: "Sell now" | "Hold" | "Wait";
  reason: string;
  confidence: number;
};
type Advice = { headline: string; recommendations: Rec[] };

const actionCfg = {
  "Sell now": { icon: ArrowUpRight, tint: "bg-af-primary/10 text-af-primary-deep" },
  Hold:       { icon: PauseCircle,  tint: "bg-af-amber/10 text-af-amber-ink" },
  Wait:       { icon: Clock,        tint: "bg-af-ai/10 text-af-ai" },
};

export default function MarketAdvice({
  prices,
  farmerCrops,
  unavailableCrops = [],  // 👈 NEW
  state,                  // 👈 NEW
}: {
  prices: {
    name: string;
    price: number;
    change: number;
    demand: string;
    notAvailable?: boolean;
  }[];
  farmerCrops: string[];
  unavailableCrops?: string[];  // 👈 NEW
  state?: string;               // 👈 NEW
}) {
  const { locale } = useT();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);

  // Farmer's crops that ARE available at mandis today
  const farmerAvailableCrops = farmerCrops.filter(
    (c) => !unavailableCrops.some(
      (u) => u.toLowerCase() === c.toLowerCase()
    )
  );

  // Farmer's crops that are NOT available today
  const farmerUnavailableCrops = farmerCrops.filter(
    (c) => unavailableCrops.some(
      (u) => u.toLowerCase() === c.toLowerCase()
    )
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/market-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prices,
            farmerCrops,
            locale,
            unavailableCrops, // 👈 NEW
            state,            // 👈 NEW
          }),
        });
        const data = await res.json();
        if (alive && res.ok) setAdvice(data);
      } catch {
        /* leave null */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-af-ai/25 blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-af-primary" />
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-white/90">
              AI Selling Advisor
            </span>
          </div>

          {/* Show farmer's unavailable crops as a warning badge */}
          {farmerUnavailableCrops.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-af-amber/20 border border-af-amber/30 px-3 py-1.5">
              <PackageX className="w-3 h-3 text-af-amber" />
              <span className="text-[10px] font-semibold text-af-amber">
                {farmerUnavailableCrops.join(", ")} not at mandis today
              </span>
            </div>
          )}
        </div>

        {/* Farmer crop availability notice */}
        {farmerUnavailableCrops.length > 0 && (
          <div className="mt-3 rounded-[12px] bg-white/[0.06] border border-white/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <PackageX className="w-4 h-4 text-af-amber shrink-0 mt-0.5" />
              <div className="text-[12px] text-white/75 leading-relaxed">
                <strong className="text-white">
                  {farmerUnavailableCrops.join(" & ")}
                </strong>{" "}
                — your crop{farmerUnavailableCrops.length > 1 ? "s are" : " is"} not
                arriving at {state ?? "local"} mandis today. AI advice below is
                based on crops currently trading.
                {farmerAvailableCrops.length > 0 && (
                  <span>
                    {" "}Your <strong className="text-white">{farmerAvailableCrops.join(", ")}</strong>{" "}
                    {farmerAvailableCrops.length > 1 ? "are" : "is"} available — check those below.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-3/4 bg-white/20" />
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
          </div>
        ) : advice ? (
          <>
            <p className="mt-4 text-[15px] font-semibold text-white/90 leading-relaxed">
              {advice.headline}
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {advice.recommendations?.slice(0, 4).map((r, i) => {
                const cfg = actionCfg[r.action] ?? actionCfg.Hold;
                const Icon = cfg.icon;

                // Check if this recommended crop is actually unavailable
                // (safety net in case AI still slips one through)
                const isUnavailable = unavailableCrops.some(
                  (u) => u.toLowerCase() === r.crop.toLowerCase()
                );

                if (isUnavailable) return null; // never show unavailable crop recs

                return (
                  <div
                    key={i}
                    className="rounded-[14px] bg-white/[0.08] border border-white/10 px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{r.crop}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.tint}`}
                      >
                        <Icon className="w-3 h-3" /> {r.action}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/70 leading-snug">
                      {r.reason}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-white/50">
                      Confidence {r.confidence}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If ALL recommendations got filtered out */}
            {advice.recommendations?.every((r) =>
              unavailableCrops.some(
                (u) => u.toLowerCase() === r.crop.toLowerCase()
              )
            ) && (
              <div className="mt-4 rounded-[14px] bg-white/[0.06] border border-white/10 px-4 py-3 text-[13px] text-white/70">
                No actionable recommendations for currently trading crops.
                Check back when your crops arrive at mandis.
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-white/70">
            Market advice is unavailable right now.
          </p>
        )}
      </div>
    </div>
  );
}