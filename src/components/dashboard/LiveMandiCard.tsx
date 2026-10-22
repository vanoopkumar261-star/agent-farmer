"use client";

/**
 * "Where should I actually sell today?" — and what the buyer charges for it.
 *
 * The board above this card shows the official data.gov.in feed: correct,
 * cached for six hours, one row per mandi per day. This card adds three things
 * that feed cannot give — a statewide roll-up, the named best and worst mandi,
 * and the retail price of the same vegetable on the same day.
 *
 * ── Why it is a button and not automatic ─────────────────────────────────────
 *
 * The free tiers are cheap but the browser rung is not, and a run takes tens of
 * seconds. Firing it on mount would spend money on every page view, including
 * the ones where the farmer only came to check the weather. So the farmer asks,
 * and then waits — and because the wait is long, the button shows elapsed
 * seconds rather than a bare spinner. A silent ninety-second spinner reads as a
 * hang, and a farmer who thinks the app has frozen will reload it and start a
 * second billable run.
 *
 * ── Two phases, because the browser outlives the request ─────────────────────
 *
 * POST runs the free rungs and comes back in a few seconds with the roll-up and
 * the retail comparison already on screen. If it also started a browser run to
 * recover the mandi names, it returns a `pendingRunId` and this card polls for
 * them. So the card is useful immediately and gets better, rather than showing
 * nothing for a minute.
 *
 * ── The label is not decoration ──────────────────────────────────────────────
 *
 * `provenance` says which tier produced the rows, and this card prints that
 * difference. "Live via TinyFish" over numbers that came from a cached REST
 * feed would be a lie, and the whole point of the feature is that the live path
 * is real. The sources republish AgMarkNet, so the card says so.
 */

import { useEffect, useRef, useState } from "react";
import { rupee } from "@/lib/format";
import { Crown, Radio, ExternalLink, Loader2, TriangleAlert, Store } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useT } from "@/components/i18n/LanguageProvider";

type LiveMandi = { name: string; price_per_quintal: number; date: string };

type Rollup = {
  rangeMinInr: number | null;
  rangeMaxInr: number | null;
  medianModalInr: number | null;
  reportingMandis: number | null;
  reportingDistricts: number | null;
  reportDate: string;
  highest: { mandi: string; priceInr: number } | null;
  lowest: { mandi: string; priceInr: number } | null;
};

type Retail = {
  item: string;
  wholesaleInrPerKg: number;
  retailLowInrPerKg: number | null;
  retailHighInrPerKg: number | null;
};

type Rung = {
  tier: string;
  label: string;
  ms: number;
  outcome: "hit" | "miss" | "skipped" | "error";
  detail?: string;
  costUsd?: number;
};

type LiveMandiOk = {
  success: true;
  mandis: LiveMandi[];
  best: { mandi: string; price: number };
  source_url: string;
  scraped_at: string;
  provenance: "fetch" | "agent" | "cache" | "datagov";
  rollup: Rollup | null;
  retail: Retail | null;
  spread: { capturedPct: number; mandiInrPerKg: number; retailInrPerKg: number } | null;
  missing: { sourceId: string; label: string; reason: string }[];
  ladder: Rung[];
  costUsd: number;
  pendingRunId?: string;
  state?: "running" | "done";
};

type LiveMandiResponse = LiveMandiOk | { success: false; error: string };

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  /** Free rungs are in, a browser run is still going. */
  | { phase: "polling"; data: LiveMandiOk }
  | { phase: "ok"; data: LiveMandiOk }
  | { phase: "error"; message: string };

/** Matches the server's own polling ceiling; a run has never taken this long. */
const POLL_MS = 5_000;
const POLL_CEILING_MS = 200_000;


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
    const busy = s.phase === "loading" || s.phase === "polling";
    if (busy) {
      if (!timer.current) timer.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [s.phase]);

  // A poll loop must not outlive the card, or an unmounted component keeps
  // hitting a paid endpoint with nowhere to put the answer.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Collects a browser run started by the POST, leaving the free rows on screen. */
  const poll = async (runId: string, partial: LiveMandiOk) => {
    const started = Date.now();
    while (alive.current && Date.now() - started < POLL_CEILING_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!alive.current) return;
      try {
        const res = await fetch(`/api/live-mandi?runId=${encodeURIComponent(runId)}`);
        if (res.status === 429) continue; // polls have their own budget; a blip is not fatal
        const data = (await res.json()) as LiveMandiResponse;
        if (!alive.current) return;

        if (data.success && data.state === "running") continue;
        if (data.success) {
          setS({ phase: "ok", data });
          return;
        }
        // The run failed or vanished. The free rungs still hold.
        setS({ phase: "ok", data: partial });
        return;
      } catch {
        setS({ phase: "ok", data: partial });
        return;
      }
    }
    // Ran out of patience, not out of data.
    if (alive.current) setS({ phase: "ok", data: partial });
  };

  const run = async () => {
    setElapsed(0);
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
      if (!data.success || (!data.mandis?.length && !data.rollup)) {
        setS({ phase: "error", message: t("liveMandi.unavailable") });
        return;
      }

      if (data.pendingRunId) {
        // Show what the free tiers found straight away, then fill in the names.
        setS({ phase: "polling", data });
        void poll(data.pendingRunId, data);
        return;
      }
      setS({ phase: "ok", data });
    } catch {
      // Never a stack trace, never a blank card.
      setS({ phase: "error", message: t("liveMandi.unavailable") });
    }
  };

  const disabled = !crop || !state || s.phase === "loading" || s.phase === "polling";

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
          {s.phase === "loading" || s.phase === "polling" ? (
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

      {(s.phase === "ok" || s.phase === "polling") && (
        <>
          {/* The statewide picture, which the per-mandi REST feed cannot give. */}
          {s.data.rollup && (
            <div className="mb-4 rounded-[16px] border border-af-border bg-af-bg p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[20px] font-semibold text-af-ink">
                  {s.data.rollup.medianModalInr ? rupee(s.data.rollup.medianModalInr) : "—"}
                </span>
                <span className="text-meta text-af-muted">{t("liveMandi.medianPerQuintal")}</span>
                {s.data.rollup.reportingMandis != null && (
                  <span className="text-[11px] text-af-muted">
                    {t("liveMandi.acrossMandis", {
                      mandis: s.data.rollup.reportingMandis,
                      districts: s.data.rollup.reportingDistricts ?? 0,
                    })}
                  </span>
                )}
              </div>

              {(s.data.rollup.highest || s.data.rollup.lowest) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-af-ink-2">
                  {s.data.rollup.highest && (
                    <span>
                      {t("liveMandi.highestAt")}{" "}
                      <strong className="text-af-ink">{s.data.rollup.highest.mandi}</strong>{" "}
                      {rupee(s.data.rollup.highest.priceInr)}
                    </span>
                  )}
                  {s.data.rollup.lowest && (
                    <span>
                      {t("liveMandi.lowestAt")}{" "}
                      <strong className="text-af-ink">{s.data.rollup.lowest.mandi}</strong>{" "}
                      {rupee(s.data.rollup.lowest.priceInr)}
                    </span>
                  )}
                </div>
              )}

              {/* The one number nothing else in the app can state: what share of
                  the shelf price reaches the farmer. Rendered only when both
                  sides are real — see computeSpread in the route. */}
              {s.data.spread && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-af-border pt-3">
                  <Store className="w-3.5 h-3.5 text-af-muted shrink-0" />
                  <span className="text-[12px] text-af-ink-2">
                    {t("liveMandi.spread", {
                      mandi: s.data.spread.mandiInrPerKg,
                      retail: s.data.spread.retailInrPerKg,
                    })}
                  </span>
                  <span className="rounded-full bg-af-primary/10 px-2 py-0.5 text-[11px] font-semibold text-af-primary-deep">
                    {t("liveMandi.captured", { pct: s.data.spread.capturedPct })}
                  </span>
                </div>
              )}
            </div>
          )}

          {s.phase === "polling" && (
            <p className="mb-3 flex items-center gap-2 text-[12px] text-af-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              {t("liveMandi.recoveringNames")}
            </p>
          )}

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
                    className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-semibold shrink-0 ${
                      isBest
                        ? "bg-af-primary text-af-on-primary"
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

          {/* How we got this: the rung-by-rung record, including what each
              tier cost. This is the honest answer to "did you really go and
              look?" and it is why the paid rung is defensible. */}
          {s.data.ladder.length > 0 && (
            <details className="mt-4 rounded-[14px] border border-af-border bg-af-bg">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-[12px] font-semibold text-af-ink-2">
                {t("liveMandi.howWeGotThis")}
                {s.data.costUsd > 0 && (
                  <span className="ml-2 font-mono font-normal text-af-muted">
                    ${s.data.costUsd.toFixed(3)}
                  </span>
                )}
              </summary>
              <ul className="space-y-1 border-t border-af-border px-4 py-3">
                {s.data.ladder.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className="font-mono font-semibold text-af-ink-2 w-12 shrink-0">{r.tier}</span>
                    <span
                      className={
                        r.outcome === "hit"
                          ? "text-af-primary-deep"
                          : r.outcome === "skipped"
                            ? "text-af-muted"
                            : "text-af-amber-ink"
                      }
                    >
                      {r.outcome}
                    </span>
                    <span className="text-af-muted">{(r.ms / 1000).toFixed(1)}s</span>
                    {r.detail && <span className="text-af-muted">· {r.detail}</span>}
                    {r.costUsd ? (
                      <span className="font-mono text-af-ink-2">${r.costUsd.toFixed(3)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Sources that produced nothing are named, never silently dropped:
              "this site blocked us" is information a farmer can act on. */}
          {s.data.missing.length > 0 && (
            <ul className="mt-3 space-y-1">
              {s.data.missing.map((m) => (
                <li key={m.sourceId + m.label} className="text-[11px] text-af-muted">
                  {m.label} — {m.reason}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-af-border pt-3">
            <span className="text-[11px] text-af-muted">
              {s.data.provenance === "datagov"
                ? t("liveMandi.viaDatagov")
                : t(
                    s.data.provenance === "cache"
                      ? "liveMandi.viaCache"
                      : s.data.provenance === "agent"
                        ? "liveMandi.viaAgent"
                        : "liveMandi.viaFetch",
                    {
                      time: new Date(s.data.scraped_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    }
                  )}
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
