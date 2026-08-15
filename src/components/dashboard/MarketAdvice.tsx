"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowUpRight, PauseCircle, Clock } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useT } from "@/components/i18n/LanguageProvider";

type Rec = { crop: string; action: "Sell now" | "Hold" | "Wait"; reason: string; confidence: number };
type Advice = { headline: string; recommendations: Rec[] };

/**
 * These chips sit on the dark forest advisor band, not on a card, so they need
 * the inverse of the usual light-surface tints. Under v2 the old
 * `text-af-primary-deep` resolved to #173B2A — the band's own colour — which
 * made "Sell now" effectively invisible. Light type on a translucent colour
 * chip instead; the icon and the word carry the state, never the hue alone.
 */
const actionCfg = {
  "Sell now": { icon: ArrowUpRight, tint: "bg-af-leaf/35 text-white" },
  Hold: { icon: PauseCircle, tint: "bg-af-amber/35 text-white" },
  Wait: { icon: Clock, tint: "bg-af-ai/40 text-white" },
};

export default function MarketAdvice({
  prices,
  farmerCrops,
}: {
  prices: { name: string; price: number; change: number; demand: string }[];
  farmerCrops: string[];
}) {
  const { locale } = useT();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/market-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prices, farmerCrops, locale }),
        });
        const data = await res.json();
        if (alive && res.ok) setAdvice(data);
      } catch {
        /* leave null */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-af-ai/25 blur-2xl" />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
          {/* Also on the dark band — af-primary is too dark to read here. */}
          <Sparkles className="w-3.5 h-3.5 text-af-sage" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-white/90">
            AI Selling Advisor
          </span>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-3/4 bg-white/20" />
            <Skeleton className="h-16 w-full bg-white/10" />
            <Skeleton className="h-16 w-full bg-white/10" />
          </div>
        ) : advice ? (
          <>
            <p className="mt-4 text-[15px] font-semibold text-white/90 leading-relaxed">{advice.headline}</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {advice.recommendations?.slice(0, 4).map((r, i) => {
                const cfg = actionCfg[r.action] ?? actionCfg.Hold;
                const Icon = cfg.icon;
                return (
                  <div key={i} className="rounded-[14px] bg-white/[0.08] border border-white/10 px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{r.crop}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.tint}`}>
                        <Icon className="w-3 h-3" /> {r.action}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/70 leading-snug">{r.reason}</p>
                    <div className="mt-2 text-[10px] font-mono text-white/50">Confidence {r.confidence}%</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-white/70">Market advice is unavailable right now.</p>
        )}
      </div>
    </div>
  );
}
