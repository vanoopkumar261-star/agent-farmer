"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  ChevronDown,
  Landmark,
  MapPin,
  RefreshCw,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { useT } from "@/components/i18n/LanguageProvider";
import type { Scheme } from "@/lib/schemes";

const CATS = ["All", "Income Support", "Insurance", "Credit", "Subsidy", "Advisory"] as const;

const catTone: Record<string, "primary" | "ai" | "amber" | "sage"> = {
  "Income Support": "primary",
  Insurance: "ai",
  Credit: "amber",
  Subsidy: "sage",
  Advisory: "sage",
};

const catLabelKey: Record<string, string> = {
  All: "schemesBoard.category.all",
  "Income Support": "schemesBoard.category.incomeSupport",
  Insurance: "schemesBoard.category.insurance",
  Credit: "schemesBoard.category.credit",
  Subsidy: "schemesBoard.category.subsidy",
  Advisory: "schemesBoard.category.advisory",
};

type Match = { headline: string; matches: { id: string; why: string }[] };

/** The shape /api/schemes returns. Mirrors SchemeDeskResult. */
type Desk = {
  schemes: Scheme[];
  provenance: "builtin" | "cache" | "search+fetch" | "agent" | "mixed";
  checkedAt: string;
  state: string | null;
  liveCount: number;
  costUsd: number;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SchemesBoard({
  schemes,
  profile,
  state,
}: {
  /** The built-in catalogue, rendered server-side so first paint is instant. */
  schemes: Scheme[];
  profile: string;
  state: string | null;
}) {
  const { locale, t } = useT();
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [desk, setDesk] = useState<Desk | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // The live list once we have one, the server-rendered floor until then. The
  // floor is never empty, so there is no loading state for the cards.
  const activeSchemes = desk?.schemes ?? schemes;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_scheme_bookmarks") ?? "[]");
      setBookmarks(new Set(saved));
    } catch {}
  }, []);

  /**
   * A 60-second spinner with nothing moving reads as a hang, and a farmer who
   * thinks the app has frozen reloads it — starting a second billable run.
   * LiveMandiCard learned this; the counter is the fix.
   */
  useEffect(() => {
    if (refreshing) {
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((v) => v + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refreshing]);

  const runMatch = useCallback(
    async (list: Scheme[]) => {
      setLoadingMatch(true);
      try {
        const res = await fetch("/api/scheme-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            schemes: list.map((s) => ({ id: s.id, name: s.name, short: s.short })),
            locale,
          }),
        });
        const data = await res.json();
        if (res.ok) setMatch(data);
      } catch {
        /* the hero degrades to "no match available"; the cards are unaffected */
      } finally {
        setLoadingMatch(false);
      }
    },
    [profile, locale]
  );

  // On mount: the cached desk (one DB read, never spends), then a match over
  // whatever list that produced.
  useEffect(() => {
    let alive = true;
    (async () => {
      let list = schemes;
      try {
        const res = await fetch(`/api/schemes?state=${encodeURIComponent(state ?? "")}`);
        if (res.ok) {
          const data: Desk = await res.json();
          if (alive && Array.isArray(data.schemes) && data.schemes.length) {
            setDesk(data);
            list = data.schemes;
          }
        }
      } catch {
        /* the built-in floor is already on screen */
      }
      if (alive) await runMatch(list);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The billable path. Only ever from a press, never on mount. */
  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      // A 429 arrives as plain text from `rateLimited()`, not JSON, so the
      // status is checked before the body is parsed.
      if (!res.ok) {
        setRefreshError(
          res.status === 429 ? t("schemesBoard.rateLimited") : t("schemesBoard.refreshFailed")
        );
        return;
      }
      const data: Desk = await res.json();
      if (Array.isArray(data.schemes) && data.schemes.length) {
        setDesk(data);
        // The hero recommends from the list it was given, so a new list needs
        // a new recommendation or the two disagree on screen.
        await runMatch(data.schemes);
      }
    } catch {
      setRefreshError(t("schemesBoard.refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  function toggleBookmark(id: string) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("af_scheme_bookmarks", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  const matchedIds = useMemo(() => new Set((match?.matches ?? []).map((m) => m.id)), [match]);
  const whyById = useMemo(() => {
    const m: Record<string, string> = {};
    (match?.matches ?? []).forEach((x) => (m[x.id] = x.why));
    return m;
  }, [match]);

  const filtered =
    cat === "All" ? activeSchemes : activeSchemes.filter((s) => s.category === cat);

  return (
    <div className="space-y-6">
      {/* Schemes surfaced from the farmer's own profile and farm details. */}
      <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-af-leaf/30 blur-2xl" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
            <Landmark className="w-3.5 h-3.5 text-af-ondark-ink" />
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-white/90">
              {t("schemesBoard.recommendedFor")}
            </span>
          </div>
          {loadingMatch ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-2/3 bg-white/20" />
              <Skeleton className="h-4 w-full bg-white/10" />
            </div>
          ) : match ? (
            <>
              <p className="mt-4 text-[15px] font-semibold text-white/90 leading-relaxed">{match.headline}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {match.matches?.map((m) => {
                  const s = activeSchemes.find((x) => x.id === m.id);
                  if (!s) return null;
                  return (
                    <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white">
                      <BadgeCheck className="w-3 h-3 text-af-ondark-ink" />
                      {s.name}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/70">{t("schemesBoard.matchUnavailable")}</p>
          )}
        </div>
      </div>

      {/* Where this list came from, and the button that refreshes it.
          The label never says "live" over a cached or built-in list — the whole
          point of carrying provenance through is that the strip cannot lie. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-af-border bg-af-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px] text-af-ink-2">
            {!desk || desk.provenance === "builtin"
              ? t("schemesBoard.sourceBuiltin")
              : desk.provenance === "cache"
              ? t("schemesBoard.sourceCache")
                  .replace("{n}", String(desk.liveCount))
                  .replace("{state}", desk.state ?? "India")
                  .replace("{when}", timeAgo(desk.checkedAt))
              : t("schemesBoard.sourceLive")
                  .replace("{n}", String(desk.liveCount))
                  .replace("{state}", desk.state ?? "India")
                  .replace("{tier}", desk.provenance === "agent" ? "Web Agent" : "Search + Fetch")}
          </p>
          {refreshError && (
            <p className="mt-1 text-[11px] font-semibold text-af-danger">{refreshError}</p>
          )}
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-af-border bg-af-bg px-3.5 py-1.5 text-meta font-semibold text-af-ink-2 transition hover:text-af-ink disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing
            ? t("schemesBoard.checking").replace("{s}", String(elapsed))
            : t("schemesBoard.checkForNew")}
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3.5 py-1.5 text-meta font-semibold transition ${
              cat === c ? "bg-af-primary text-af-on-primary shadow-af-sm" : "bg-af-card border border-af-border text-af-ink-2 hover:text-af-ink"
            }`}
          >
            {t(catLabelKey[c])}
          </button>
        ))}
      </div>

      {/* Scheme cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => {
          const isMatch = matchedIds.has(s.id);
          const isOpen = expanded === s.id;
          const marked = bookmarks.has(s.id);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-primary shrink-0">
                    <Landmark className="w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-af-ink truncate">{s.name}</h3>
                      {isMatch && <Badge tone="primary">{t("schemesBoard.recommended")}</Badge>}
                      {/* Lets a farmer tell a Karnataka portal entry from a
                          central scheme without opening the card. */}
                      {s.scope === "state" && (
                        <Badge tone="ai">{t("schemesBoard.stateScheme")}</Badge>
                      )}
                    </div>
                    <div className="text-[12px] text-af-muted truncate">{s.short}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleBookmark(s.id)}
                  aria-pressed={marked}
                  aria-label={t(marked ? "a11y.bookmarkRemove" : "a11y.bookmarkAdd")}
                  className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition ${
                    marked ? "text-af-primary-deep bg-af-primary/10" : "text-af-muted hover:text-af-ink hover:bg-af-bg"
                  }`}
                >
                  {marked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Badge tone={catTone[s.category]}>{catLabelKey[s.category] ? t(catLabelKey[s.category]) : s.category}</Badge>
                {/* A live scheme's page often states no deadline, and the
                    extractor is forbidden from inventing one. An empty chip is
                    better than a confident wrong date, and omitting the chip is
                    better than an empty one. */}
                {s.deadline && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-ink-2">
                    <CalendarClock className="w-3.5 h-3.5 text-af-amber" /> {s.deadline}
                  </span>
                )}
                {s.source === "live" && s.sourceUrl && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-af-muted">
                    <MapPin className="w-3 h-3" />
                    {new URL(s.sourceUrl).host.replace(/^www\./, "")}
                  </span>
                )}
              </div>

              {isMatch && whyById[s.id] && (
                <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-af-primary/[0.06] border border-af-primary/15 px-3 py-2">
                  <BadgeCheck className="w-3.5 h-3.5 text-af-primary-deep mt-0.5 shrink-0" />
                  <span className="text-[12px] text-af-ink-2">{whyById[s.id]}</span>
                </div>
              )}

              <p className="mt-3 text-meta text-af-ink-2 leading-relaxed">{s.benefit}</p>

              {isOpen && (
                <div className="mt-3 rounded-[12px] bg-af-bg border border-af-border p-3">
                  <div className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted mb-1.5">
                    {t("schemesBoard.eligibility")}
                  </div>
                  {s.eligibility.length ? (
                    <ul className="text-[12px] text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
                      {s.eligibility.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    // Said plainly, because "we did not find this" and "there
                    // are no conditions" are very different facts to act on.
                    <p className="text-[12px] text-af-muted">{t("schemesBoard.eligibilityUnknown")}</p>
                  )}
                  {s.authority && (
                    <div className="mt-2 text-[11px] text-af-muted">{t("schemesBoard.authority", { authority: s.authority })}</div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="inline-flex items-center gap-1 text-meta font-semibold text-af-ink-2 hover:text-af-ink transition"
                >
                  {isOpen ? t("schemesBoard.hideDetails") : t("schemesBoard.eligibility")}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <a
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-af-primary hover:bg-af-primary-deep text-af-on-primary px-3.5 py-2 text-meta font-semibold transition"
                >
                  {t("schemesBoard.apply")} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
