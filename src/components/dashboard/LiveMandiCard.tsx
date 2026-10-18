"use client";

/**
 * "Where should I actually sell today?" — answered by a web agent, on demand.
 *
 * The board above this card shows the official data.gov.in feed: correct,
 * cached for six hours, one row per mandi per day. This card does something
 * different — it sends a TinyFish browser agent to agmarknet.gov.in to read
 * today's board across mandis and rank them.
 *
 * ── Why it is a button and not automatic ─────────────────────────────────────
 *
 * A run takes tens of seconds and costs real credit. Firing it on mount would
 * spend money on every page view, including the ones where the farmer only came
 * to check the weather. So the farmer asks, and then waits — and because the
 * wait is long, the button shows elapsed seconds rather than a bare spinner. A
 * silent ninety-second spinner reads as a hang, and a farmer who thinks the app
 * has frozen will reload it and start a second billable run.
 *
 * ── The label is not decoration ──────────────────────────────────────────────
 *
 * The route falls back to the official API when the agent fails, and says so in
 * `provenance`. This card prints that difference. "Live via TinyFish" over
 * numbers that came from a cached REST feed would be a lie, and the whole point
 * of the feature is that the live path is real.
 */

import { useEffect, useRef, useState } from "react";
import { Crown, Radio, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useT } from "@/components/i18n/LanguageProvider";

type LiveMandi = { name: string; price_per_quintal: number; date: string };

type LiveMandiResponse =
  | {
      success: true;
      mandis: LiveMandi[];
      best: { mandi: string; price: number };
      source_url: string;
      scraped_at: string;
      provenance: "tinyfish" | "datagov";
    }
  | { success: false; error: string };

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ok"; data: Extract<LiveMandiResponse, { success: true }> }
  | { phase: "error"; message: string };

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function LiveMandiCard({
  crop,
  state,
}: {
  crop: string;
  state: string | null;
}) {
  const { t } = useT();
  const [s, setS] = useState<State>({ phase: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (s.phase === "loading") {
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [s.phase]);

  const run = async () => {
    setS({ phase: "loading" });
    try {
      const res = await fetch("/api/live-mandi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crop, state }),
      });

      // A 429 arrives as plain text from `rateLimited()`, not JSON, so the
      // status is checked before the body is parsed.
      if (res.status === 429) {
        setS({ phase: "error", message: t("liveMandi.tooMany") });
        return;
      }

      const data = (await res.json()) as LiveMandiResponse;
      if (!data.success || !data.mandis?.length) {
        setS({ phase: "error", message: t("liveMandi.unavailable") });
        return;
      }
      setS({ phase: "ok", data });
    } catch {
      // Never a stack trace, never a blank card.
      setS({ phase: "error", message: t("liveMandi.unavailable") });
    }
  };

  const disabled = !crop || !state || s.phase === "loading";

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-af-ai-soft text-af-ai">
            <Radio className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">
              {t("liveMandi.title")}
            </h2>
            <p className="text-meta text-af-muted">
              {crop && state
                ? t("liveMandi.subtitle", { crop, state })
                : t("liveMandi.needCropState")}
            </p>
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={run} disabled={disabled}>
          {s.phase === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("liveMandi.working", { secs: elapsed })}
            </>
          ) : (
            t(s.phase === "ok" ? "liveMandi.again" : "liveMandi.compare")
          )}
        </Button>
      </div>

      {s.phase === "idle" && (
        <p className="text-sm text-af-ink-2">{t("liveMandi.idle")}</p>
      )}

      {s.phase === "loading" && (
        <p className="text-sm text-af-ink-2">{t("liveMandi.loadingBody")}</p>
      )}

      {s.phase === "error" && (
        <div className="flex items-start gap-3 rounded-[14px] border border-af-border bg-af-bg p-4">
          <TriangleAlert className="w-4 h-4 text-af-amber-ink shrink-0 mt-0.5" />
          <p className="text-sm text-af-ink-2">{s.message}</p>
        </div>
      )}

      {s.phase === "ok" && (
        <>
          <ol className="space-y-2">
            {s.data.mandis.map((m, i) => {
              const isBest = i === 0;
              return (
                <li
                  key={`${m.name}-${i}`}
                  className={`flex items-center gap-3 rounded-[16px] border px-3 py-2.5 ${
                    isBest
                      ? "border-af-primary/40 bg-af-primary/[0.03]"
                      : "border-af-border bg-af-bg"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold shrink-0 ${
                      isBest
                        ? "bg-af-primary text-white"
                        : "bg-af-card text-af-muted border border-af-border"
                    }`}
                  >
                    {isBest ? <Crown className="w-3.5 h-3.5" /> : i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-af-ink truncate">{m.name}</div>
                    <div className="text-[11px] text-af-muted">
                      {m.date ? m.date : "—"}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-[15px] font-semibold text-af-ink">
                      {rupee(m.price_per_quintal)}
                    </div>
                    <div className="text-[11px] text-af-muted">{t("liveMandi.perQuintal")}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-af-border pt-3">
            <span className="text-[11px] text-af-muted">
              {s.data.provenance === "tinyfish"
                ? t("liveMandi.viaTinyfish", {
                    time: new Date(s.data.scraped_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })
                : t("liveMandi.viaDatagov")}
            </span>
            <a
              href={s.data.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-primary-deep hover:underline"
            >
              {s.data.source_url.replace(/^https?:\/\//, "")}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </Card>
  );
}
