"use client";

import { useState, useEffect } from "react";
import {
  Newspaper,
  ExternalLink,
  Clock,
  Sprout,
  Droplets,
  TrendingUp,
  Globe,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import type { NewsArticle } from "@/app/api/news/route";
import { useT, T } from "@/components/i18n/LanguageProvider";

const categoryConfig = {
  crop: {
    labelKey: "newsCard.category.crop",
    icon: Sprout,
    color: "text-af-primary-deep",
    bg: "bg-af-primary/10",
    border: "border-af-primary/20",
    dot: "bg-af-primary",
  },
  oilseed: {
    labelKey: "newsCard.category.oilseed",
    icon: Droplets,
    color: "text-af-secondary",
    bg: "bg-af-secondary/10",
    border: "border-af-secondary/20",
    dot: "bg-af-secondary",
  },
  farming: {
    labelKey: "newsCard.category.farming",
    icon: TrendingUp,
    color: "text-af-ai",
    bg: "bg-af-ai/10",
    border: "border-af-ai/20",
    dot: "bg-af-ai",
  },
  general: {
    labelKey: "newsCard.category.general",
    icon: Globe,
    color: "text-af-muted",
    bg: "bg-af-bg",
    border: "border-af-border",
    dot: "bg-af-muted",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Article images come from an external news provider and point at arbitrary
 * hosts. Route every https image through our own proxy so the browser never
 * talks directly to those hosts (no IP / Referer leak) and the CSP can stay
 * `img-src 'self'`.
 */
function proxied(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") ? `/api/img?u=${encodeURIComponent(url)}` : null;
}

/** An href only if it is a real http(s) link — never `javascript:` / `data:`. */
function safeLink(url: string): string | undefined {
  if (url === "#") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// ── Single news card ──────────────────────────────────────────────────────────
function ArticleCard({
  article,
  featured,
}: {
  article: NewsArticle;
  featured?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const cfg = categoryConfig[article.category];
  const Icon = cfg.icon;
  const img = proxied(article.imageUrl);
  const href = safeLink(article.url);

  if (featured) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-[20px] border border-af-border bg-af-card shadow-af-sm hover:shadow-af-md hover:-translate-y-0.5 transition-all"
      >
        {/* Image */}
        <div className="relative h-52 w-full overflow-hidden bg-af-bg">
          {!imgError && img ? (
            <img
              src={img}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-af-sage">
              <Newspaper className="w-10 h-10 text-af-secondary opacity-40" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Category badge on image */}
          <div className="absolute top-3 left-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold font-mono tracking-[0.12em] uppercase backdrop-blur-sm bg-black/30 border border-white/20 text-white`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <T k={cfg.labelKey} />
              {article.relevantCrop && ` · ${article.relevantCrop}`}
            </span>
          </div>

          {/* External link icon */}
          {href && (
            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-3.5 h-3.5 text-white" />
            </div>
          )}

          {/* Title on image bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-sans font-bold text-white text-[15px] leading-snug line-clamp-2">
              {article.title}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {article.summary && (
            <p className="text-[13px] text-af-ink-2 leading-relaxed line-clamp-2">
              {article.summary}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-af-muted truncate max-w-[60%]">
              {article.source}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-af-muted">
              <Clock className="w-3 h-3" />
              {timeAgo(article.publishedAt)}
            </span>
          </div>
        </div>
      </a>
    );
  }

  // ── Compact list card ────────────────────────────────────────────────────
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-[16px] border border-af-border bg-af-card hover:border-af-primary/30 hover:bg-af-card/80 hover:-translate-y-0.5 transition-all p-3 shadow-af-sm"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-16 shrink-0 rounded-[10px] overflow-hidden bg-af-bg">
        {!imgError && img ? (
          <img
            src={img}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-af-sage">
            <Icon className="w-5 h-5 text-af-secondary opacity-50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-[0.12em] uppercase ${cfg.bg} ${cfg.color}`}
          >
            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
            <T k={cfg.labelKey} />
          </span>
        </div>
        <h3 className="font-sans font-semibold text-af-ink text-[13px] leading-snug line-clamp-2 group-hover:text-af-primary-deep transition-colors">
          {article.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-af-muted font-semibold truncate">
            {article.source}
          </span>
          <span className="text-af-border">·</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-af-muted shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-af-muted shrink-0 mt-1 group-hover:text-af-primary transition-colors" />
    </a>
  );
}

// ── Main NewsCard component ───────────────────────────────────────────────────
export default function NewsCard({
  farmerCrops,
  state,
}: {
  farmerCrops: string[];
  state: string | null;
}) {
  const { t } = useT();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "ai" | "error">("live");
  const [provider, setProvider] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchNews(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerCrops, state }),
      });
      const data = await res.json();
      setArticles(data.articles ?? []);
      setDataSource(data.source ?? "error");
      setProvider(data.provider ?? null);
    } catch {
      setDataSource("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split articles
  const cropNews = articles.filter((a) => a.category === "crop");
  const oilseedNews = articles.filter((a) => a.category === "oilseed");
  const farmingNews = articles.filter((a) => a.category === "farming");
  const generalNews = articles.filter((a) => a.category === "general");

  // Featured = top 2 (highest priority)
  const featured = articles.slice(0, 2);
  const rest = articles.slice(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-af-sage text-af-secondary">
            <Newspaper className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-af-ink">
              {t("newsCard.title")}
            </h2>
            <p className="text-[13px] text-af-ink-2">
              {t("newsCard.subtitle")}
              {state && ` · ${state}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Source badge */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold font-mono tracking-[0.12em] uppercase ${
              dataSource === "live"
                ? "bg-af-primary/10 border-af-primary/20 text-af-primary-deep"
                : dataSource === "ai"
                ? "bg-af-ai/10 border-af-ai/20 text-af-ai"
                : "bg-af-bg border-af-border text-af-muted"
            }`}
          >
            {dataSource === "live" ? (
              <><Wifi className="w-3 h-3" /> {t("newsCard.live")}{provider ? ` · ${provider}` : ""}</>
            ) : dataSource === "ai" ? (
              <><Wifi className="w-3 h-3" /> {t("newsCard.aiGeneratedGroq")}</>
            ) : (
              <><WifiOff className="w-3 h-3" /> {t("newsCard.unavailable")}</>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchNews(true)}
            disabled={refreshing || loading}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-card border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition disabled:opacity-40"
            title={t("newsCard.refresh")}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Category legend */}
      {!loading && articles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {farmerCrops.length > 0 && cropNews.length > 0 && (
            <LegendChip cfg={categoryConfig.crop} count={cropNews.length} label={t("newsCard.yourCrops", { crops: farmerCrops.join(", ") })} />
          )}
          {oilseedNews.length > 0 && (
            <LegendChip cfg={categoryConfig.oilseed} count={oilseedNews.length} label={t("newsCard.category.oilseed")} />
          )}
          {farmingNews.length > 0 && (
            <LegendChip cfg={categoryConfig.farming} count={farmingNews.length} label={t("newsCard.agriculture")} />
          )}
          {generalNews.length > 0 && (
            <LegendChip cfg={categoryConfig.general} count={generalNews.length} label={t("newsCard.category.general")} />
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-[20px] border border-af-border overflow-hidden">
                <Skeleton className="h-52 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3 rounded-[16px] border border-af-border">
                <Skeleton className="w-20 h-16 shrink-0 rounded-[10px]" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No articles */}
      {!loading && articles.length === 0 && (
        <Card className="p-10 text-center">
          <Newspaper className="w-10 h-10 text-af-muted opacity-30 mx-auto mb-3" />
          <p className="text-sm text-af-muted">
            {t("newsCard.noNews")}
          </p>
          <button
            onClick={() => fetchNews(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-af-primary text-white px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            {t("newsCard.tryAgain")}
          </button>
        </Card>
      )}

      {/* Featured articles - 2 column grid with big cards */}
      {!loading && featured.length > 0 && (
        <div>
          <SectionDivider
            label={featured[0]?.category === "crop" ? t("newsCard.yourCropNews") : t("newsCard.topStories")}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {featured.map((a) => (
              <ArticleCard key={a.id} article={a} featured />
            ))}
          </div>
        </div>
      )}

      {/* Rest of the articles - compact list */}
      {!loading && rest.length > 0 && (
        <div>
          <SectionDivider label={t("newsCard.moreStories")} />
          <div className="mt-3 space-y-2.5">
            {rest.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {!loading && articles.length > 0 && (
        <div className="text-center text-[11px] text-af-muted pt-2">
          {dataSource === "live"
            ? t("newsCard.footerLive")
            : t("newsCard.footerAi")}
        </div>
      )}
    </div>
  );
}

function LegendChip({
  cfg,
  count,
  label,
}: {
  cfg: (typeof categoryConfig)[keyof typeof categoryConfig];
  count: number;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}
      <span className="ml-0.5 opacity-60">({count})</span>
    </span>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-af-border" />
      <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-af-muted whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-af-border" />
    </div>
  );
}