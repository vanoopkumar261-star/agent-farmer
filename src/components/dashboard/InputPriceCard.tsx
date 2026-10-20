"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, PackageSearch, Search, Loader2, Info } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useT } from "@/components/i18n/LanguageProvider";

type Row = {
  siteId: string;
  siteLabel: string;
  productName: string;
  priceInr: number;
  unit: string;
  url: string;
  tier: "search" | "fetch" | "agent";
};
type Miss = { siteId: string; siteLabel: string; reason: string };
type Rung = { tier: string; label: string; ms: number; outcome: string; detail?: string; costUsd?: number };

type Report = {
  category: string;
  term: string;
  rows: Row[];
  missing: Miss[];
  provenance: string;
  ladder: Rung[];
  costUsd: number;
  checkedAt: string;
  pendingRunId?: string;
  pendingSite?: string;
};

const CATEGORIES = ["fertiliser", "seed", "pesticide"] as const;

/** How the row was obtained. Shown per row, because the tiers differ in cost. */
const tierTone: Record<Row["tier"], "sage" | "primary" | "ai"> = {
  search: "sage",
  fetch: "primary",
  agent: "ai",
};

/**
 * Polling cadence for an in-flight browser run.
 *
 * Measured runs take 70–166 s, so a five-second poll is roughly 15–35 requests
 * — cheap (polling is free) and responsive enough that the table fills within a
 * few seconds of the run actually finishing.
 */
const POLL_MS = 5_000;
/** Give up after this long. A run past three minutes is not coming back. */
const POLL_CEILING_MS = 200_000;

export default function InputPriceCard() {
  const { t } = useT();
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("fertiliser");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLadder, setShowLadder] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // A search with a billable tail needs visible progress, or a farmer who
  // thinks it has frozen presses the button again and starts a second run.
  useEffect(() => {
    if (busy || waiting) {
      tick.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } else if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [busy, waiting]);

  useEffect(
    () => () => {
      if (poll.current) clearInterval(poll.current);
    },
    []
  );

  function startPolling(runId: string) {
    const startedAt = Date.now();
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_CEILING_MS) {
        clearInterval(poll.current!);
        poll.current = null;
        setWaiting(null);
        setError(t("inputs.runTimedOut"));
        return;
      }
      try {
        const res = await fetch(`/api/input-prices?runId=${encodeURIComponent(runId)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (data.state === "running") return;
        clearInterval(poll.current!);
        poll.current = null;
        setWaiting(null);
        setReport(data as Report);
      } catch {
        clearInterval(poll.current!);
        poll.current = null;
        setWaiting(null);
        setError(t("inputs.runFailed"));
      }
    }, POLL_MS);
  }

  async function run() {
    const q = term.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setElapsed(0);
    setReport(null);
    setWaiting(null);
    try {
      const res = await fetch("/api/input-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, term: q }),
      });
      // A 429 arrives as plain text from rateLimited(), so check before parsing.
      if (!res.ok) {
        setError(res.status === 429 ? t("inputs.rateLimited") : t("inputs.failed"));
        return;
      }
      const data: Report = await res.json();
      setReport(data);
      // The free rungs came up short and a browser run is in flight. Whatever
      // they did find is already on screen; the run adds to it.
      if (data.pendingRunId) {
        setWaiting(data.pendingSite ?? "");
        startPolling(data.pendingRunId);
      }
    } catch {
      setError(t("inputs.failed"));
    } finally {
      setBusy(false);
    }
  }

  const sorted = report ? [...report.rows].sort((a, b) => a.priceInr - b.priceInr) : [];
  const best = sorted[0];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 shrink-0">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3.5 py-1.5 text-meta font-semibold transition ${
                  category === c
                    ? "bg-af-primary text-white shadow-af-sm"
                    : "bg-af-bg border border-af-border text-af-ink-2 hover:text-af-ink"
                }`}
              >
                {t(`inputs.category.${c}`)}
              </button>
            ))}
          </div>

          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-af-muted" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder={t("inputs.placeholder")}
                className="w-full rounded-[12px] border border-af-border bg-af-bg py-2 pl-9 pr-3 text-[14px] text-af-ink placeholder:text-af-muted focus:outline-none focus:ring-2 focus:ring-af-primary/30"
              />
            </div>
            <button
              onClick={run}
              disabled={busy || !term.trim()}
              className="shrink-0 inline-flex items-center gap-2 rounded-[12px] bg-af-primary hover:bg-af-primary-deep text-white px-4 py-2 text-meta font-semibold transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
              {t("inputs.compare")}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-[12px] font-semibold text-af-danger">{error}</p>}

        {waiting && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-af-ai/20 bg-af-ai/[0.06] px-3.5 py-3">
            <Loader2 className="w-4 h-4 text-af-ai animate-spin mt-0.5 shrink-0" />
            <div className="text-[12px] text-af-ink-2 leading-relaxed">
              {/* Named plainly, because this is the step that costs money and
                  the farmer should know why it is being taken. */}
              {t("inputs.browsing").replace("{site}", waiting).replace("{s}", String(elapsed))}
            </div>
          </div>
        )}
      </Card>

      {report && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold text-af-ink">
              {t("inputs.resultsFor").replace("{term}", report.term)}
            </h3>
            <button
              onClick={() => setShowLadder((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-af-muted hover:text-af-ink transition"
            >
              <Info className="w-3.5 h-3.5" />
              {t("inputs.howWeGotThis")}
            </button>
          </div>

          {/* The ladder, verbatim. It says which tier produced each answer and
              what the paid one cost — the same record the server logs. */}
          {showLadder && (
            <div className="mt-3 rounded-[12px] bg-af-bg border border-af-border p-3 font-mono text-[11px] text-af-ink-2 space-y-1">
              {report.ladder.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-14 shrink-0 font-semibold">{r.tier}</span>
                  <span className="w-12 shrink-0 text-af-muted">{(r.ms / 1000).toFixed(1)}s</span>
                  <span className="w-14 shrink-0">{r.outcome}</span>
                  <span className="flex-1 text-af-muted break-words">
                    {r.detail}
                    {r.costUsd ? ` · $${r.costUsd.toFixed(3)}` : ""}
                  </span>
                </div>
              ))}
              <div className="pt-1 border-t border-af-border text-af-muted">
                {t("inputs.totalCost").replace("{cost}", report.costUsd.toFixed(3))}
              </div>
            </div>
          )}

          {sorted.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono font-semibold tracking-[0.14em] uppercase text-af-muted">
                    <th className="pb-2 pr-3 font-semibold">{t("inputs.col.product")}</th>
                    <th className="pb-2 pr-3 font-semibold">{t("inputs.col.seller")}</th>
                    <th className="pb-2 pr-3 font-semibold text-right">{t("inputs.col.price")}</th>
                    <th className="pb-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={`${r.siteId}-${i}`} className="border-t border-af-border">
                      <td className="py-2.5 pr-3 align-top">
                        <div className="text-[13px] text-af-ink leading-snug">{r.productName}</div>
                        {r.unit && <div className="text-[11px] text-af-muted">{r.unit}</div>}
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[12px] font-semibold text-af-ink-2">{r.siteLabel}</span>
                          <Badge tone={tierTone[r.tier]}>{t(`inputs.tier.${r.tier}`)}</Badge>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 align-top text-right">
                        <span
                          className={`text-[14px] font-semibold tabular-nums ${
                            r === best ? "text-af-primary-deep" : "text-af-ink"
                          }`}
                        >
                          ₹{r.priceInr.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="py-2.5 align-top">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-primary-deep hover:underline"
                        >
                          {t("inputs.open")} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !waiting && <p className="mt-4 text-[13px] text-af-ink-2">{t("inputs.noQuotes")}</p>
          )}

          {/* Sites that gave nothing are named with the reason. A comparison
              that quietly omits a seller reads as "we checked everywhere". */}
          {report.missing.length > 0 && (
            <div className="mt-4 rounded-[12px] bg-af-bg border border-af-border p-3">
              <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted mb-1.5">
                {t("inputs.notChecked")}
              </div>
              <ul className="text-[11px] text-af-muted leading-relaxed space-y-0.5">
                {report.missing.map((m) => (
                  <li key={m.siteId}>
                    <span className="font-semibold text-af-ink-2">{m.siteLabel}</span> — {m.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
