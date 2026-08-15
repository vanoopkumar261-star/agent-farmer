"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  ChevronDown,
  Landmark,
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

type Match = { headline: string; matches: { id: string; why: string }[] };

export default function SchemesBoard({
  schemes,
  profile,
}: {
  schemes: Scheme[];
  profile: string;
}) {
  const { locale } = useT();
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_scheme_bookmarks") ?? "[]");
      setBookmarks(new Set(saved));
    } catch {}
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/scheme-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, schemes: schemes.map((s) => ({ id: s.id, name: s.name, short: s.short })), locale }),
        });
        const data = await res.json();
        if (alive && res.ok) setMatch(data);
      } catch {
      } finally {
        if (alive) setLoadingMatch(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filtered = cat === "All" ? schemes : schemes.filter((s) => s.category === cat);

  return (
    <div className="space-y-6">
      {/* Schemes surfaced from the farmer's own profile and farm details. */}
      <div className="relative overflow-hidden rounded-2xl bg-af-secondary text-white shadow-af-md p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-af-leaf/30 blur-2xl" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
            <Landmark className="w-3.5 h-3.5 text-af-sage" />
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-white/90">
              Recommended schemes for your farm
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
                  const s = schemes.find((x) => x.id === m.id);
                  if (!s) return null;
                  return (
                    <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white">
                      <BadgeCheck className="w-3 h-3 text-af-sage" />
                      {s.name}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/70">Match unavailable right now — browse all schemes below.</p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3.5 py-1.5 text-meta font-semibold transition ${
              cat === c ? "bg-af-primary text-white shadow-af-sm" : "bg-af-card border border-af-border text-af-ink-2 hover:text-af-ink"
            }`}
          >
            {c}
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
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary shrink-0">
                    <Landmark className="w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-af-ink truncate">{s.name}</h3>
                      {isMatch && <Badge tone="primary">Recommended</Badge>}
                    </div>
                    <div className="text-[12px] text-af-muted truncate">{s.short}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleBookmark(s.id)}
                  className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition ${
                    marked ? "text-af-primary-deep bg-af-primary/10" : "text-af-muted hover:text-af-ink hover:bg-af-bg"
                  }`}
                >
                  {marked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Badge tone={catTone[s.category]}>{s.category}</Badge>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-af-ink-2">
                  <CalendarClock className="w-3.5 h-3.5 text-af-amber" /> {s.deadline}
                </span>
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
                    Eligibility
                  </div>
                  <ul className="text-[12px] text-af-ink-2 leading-relaxed list-disc pl-4 space-y-0.5">
                    {s.eligibility.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[11px] text-af-muted">Authority: {s.authority}</div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="inline-flex items-center gap-1 text-meta font-semibold text-af-ink-2 hover:text-af-ink transition"
                >
                  {isOpen ? "Hide details" : "Eligibility"}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <a
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-af-primary hover:bg-af-primary-deep text-white px-3.5 py-2 text-meta font-semibold transition"
                >
                  Apply <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
