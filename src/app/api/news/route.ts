import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/http";
import { tfSearch } from "@/lib/tinyfish";
import { anyKeyConfigured } from "@/lib/tfKeys";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { clampArr, clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";
import { translateMany } from "@/lib/translate";
import { LOCALES, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const GNEWS_URL = "https://gnews.io/api/v4/search";
const NEWSAPI_URL = "https://newsapi.org/v2/everything";

// How long a given query's results are cached. Also the effective ceiling on
// upstream calls: one hit per unique (crops, state) query set per window.
const REVALIDATE = 1800; // 30 min

// Indian outlets we trust for farm coverage. Agriculture-desk publishers first
// (BusinessLine, Krishi Jagran, Down To Earth, Rural Voice, Commodity Online),
// then mainstream papers that run a standing agriculture section. Only NewsAPI
// supports a domain filter — GNews leans on `country=in` instead.
const NEWSAPI_DOMAINS = [
  "thehindubusinessline.com",
  "krishijagran.com",
  "downtoearth.org.in",
  "ruralvoice.in",
  "commodityonline.com",
  "agriculturepost.com",
  "thehindu.com",
  "economictimes.indiatimes.com",
  "livemint.com",
  "financialexpress.com",
  "business-standard.com",
  "hindustantimes.com",
  "indianexpress.com",
  "ndtv.com",
].join(",");

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  category: "crop" | "oilseed" | "farming" | "general";
  relevantCrop?: string;
  /**
   * True when `imageUrl` is one of our themed stock photos rather than the
   * publisher's own picture. The card prints a caption saying so: a wheat photo
   * beside a wheat story is decoration, and decoration that looks like
   * reporting is the quiet kind of lie.
   */
  imageIsStock: boolean;
};

// Curated farming image pool - high quality, themed to match your site
const FARMING_IMAGES = {
  wheat:      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80",
  paddy:      "https://images.unsplash.com/photo-1536054216-51e7b3e3f6b0?w=800&q=80",
  rice:       "https://images.unsplash.com/photo-1536054216-51e7b3e3f6b0?w=800&q=80",
  maize:      "https://images.unsplash.com/photo-1601593768799-76e2c3dbcba6?w=800&q=80",
  corn:       "https://images.unsplash.com/photo-1601593768799-76e2c3dbcba6?w=800&q=80",
  tomato:     "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=800&q=80",
  onion:      "https://images.unsplash.com/photo-1587735243475-37b1a9d7e46a?w=800&q=80",
  potato:     "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&q=80",
  cotton:     "https://images.unsplash.com/photo-1611735341450-74d61e660ad2?w=800&q=80",
  sugarcane:  "https://images.unsplash.com/photo-1559181567-c3190ca9d70a?w=800&q=80",
  soybean:    "https://images.unsplash.com/photo-1567306301408-9b74779a11af?w=800&q=80",
  groundnut:  "https://images.unsplash.com/photo-1567306301408-9b74779a11af?w=800&q=80",
  sunflower:  "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&q=80",
  mustard:    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80",
  bajra:      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80",
  oilseed:    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80",
  rain:       "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80",
  drought:    "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&q=80",
  market:     "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
  mandi:      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
  scheme:     "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
  government: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
  pest:       "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&q=80",
  disease:    "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&q=80",
  irrigation: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80",
  soil:       "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80",
  harvest:    "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80",
  farmer:     "https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?w=800&q=80",
  default:    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
};

const OILSEED_CROPS = [
  "sunflower", "mustard", "soybean", "groundnut",
  "sesame", "linseed", "castor", "safflower", "niger",
];

// A headline must hit one of these to count as farm news. Deliberately excludes
// weak, ambiguous words (monsoon, weather, rain, soil, drought on their own) —
// those ride along on a real farm term but never qualify a story by themselves.
const CORE_AGRI =
  /\b(farmer|farmers|farming|farm|agricultur\w*|agri|agrarian|kisan|krishi|mandi|mandis|apmc|msp|kharif|rabi|zaid|sowing|acreage|harvest\w*|horticultur\w*|oilseed|oilseeds|procure\w*|foodgrain|foodgrains|pmfby|pm-?kisan|fertiliser|fertilizer|cultivation|crop|crops|paddy|wheat|sugarcane|millet|millets|pulses|nabard|agri-?tech|agmarknet|enam)\b/i;

// Farm-context clause shared by the crop and oilseed queries — it keeps company
// names ("Greaves Cotton", "Nitin Spinners", "Padam Cotton Yarns") from matching
// a crop word.
const CTX =
  "crop OR crops OR farmer OR farmers OR mandi OR MSP OR price OR prices OR output OR yield OR acreage OR sowing OR harvest OR procurement OR arrivals OR kharif OR rabi";

/**
 * Returns the image and whether it is ours rather than the publisher's.
 *
 * The flag exists because TinyFish Search returns no images at all, so the
 * stock pool went from "occasional filler" to "most of the grid". A themed
 * photo is still better than a wall of blank tiles, but the card has to be able
 * to say which it is.
 */
function pickImage(title: string, apiImage: string | null): { url: string; isStock: boolean } {
  // Try API image first - only use if it's a real image URL (not a placeholder)
  if (
    apiImage &&
    apiImage.startsWith("http") &&
    !apiImage.includes("placeholder") &&
    !apiImage.includes("via.placeholder") &&
    !apiImage.includes("null")
  ) {
    return { url: apiImage, isStock: false };
  }

  // Match keywords in title to themed farming images
  const lower = title.toLowerCase();
  for (const [keyword, url] of Object.entries(FARMING_IMAGES)) {
    if (lower.includes(keyword)) return { url, isStock: true };
  }
  return { url: FARMING_IMAGES.default, isStock: true };
}

function categorize(
  title: string,
  description: string,
  farmerCrops: string[]
): { category: NewsArticle["category"]; relevantCrop?: string } {
  const text = `${title} ${description}`.toLowerCase();

  // Check farmer's own crops first (highest priority)
  for (const crop of farmerCrops) {
    if (text.includes(crop.toLowerCase())) {
      return { category: "crop", relevantCrop: crop };
    }
  }

  // Check oilseeds
  for (const oil of OILSEED_CROPS) {
    if (text.includes(oil)) {
      return { category: "oilseed", relevantCrop: oil };
    }
  }

  // General farming keywords
  const farmingKeywords = [
    "farmer", "farm", "crop", "agriculture", "agri", "kisan",
    "mandi", "harvest", "irrigation", "soil", "fertilizer", "fertiliser",
    "pesticide", "weather", "monsoon", "drought", "yield",
    "seed", "paddy", "wheat", "maize", "sowing", "rabi", "kharif",
    "msp", "apmc", "krishi", "pm-kisan", "urea", "dap",
    "subsidy", "procurement", "mandal", "gram panchayat",
    "agrimarket", "cold storage", "food grain", "foodgrain", "horticulture",
    "dairy", "poultry", "fisheries", "organic farming",
    "soil health", "crop insurance", "pmfby", "nabard",
    "fpo", "cooperative", "minimum support price", "agrarian",
    "sugarcane", "cotton", "pulses", "millet", "rainfall", "acreage",
  ];
  if (farmingKeywords.some((k) => text.includes(k))) {
    return { category: "farming" };
  }

  return { category: "general" };
}

// ── Shared shaping ────────────────────────────────────────────────────────────

// The lowest common denominator of a news-provider article, so the ranking is
// written once regardless of which API produced it.
type RawItem = {
  title: string;
  description: string;
  content?: string;
  url: string;
  image: string | null;
  publishedAt: string;
  sourceName: string;
};

/**
 * Dedupe → relevance-gate → rank → cap.
 *
 * Rank order: the farmer's own crop → news from their state → oilseeds →
 * general farming. Anything `categorize` can only call "general", or whose
 * headline carries no real farm term, is dropped rather than shown as filler.
 */
function rankArticles(raw: RawItem[], farmerCrops: string[], state: string): NewsArticle[] {
  const hasState = !!state && state.toLowerCase() !== "india";
  const stateLower = state.toLowerCase();

  const seen = new Set<string>();
  const deduped = raw.filter((a) => {
    if (!a.title || a.title === "[Removed]") return false;
    const norm = a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!norm || seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  const scored = deduped
    .map((a, i) => {
      const { category, relevantCrop } = categorize(a.title, a.description, farmerCrops);
      const inState =
        hasState && `${a.title} ${a.description}`.toLowerCase().includes(stateLower);
      const image = pickImage(a.title, a.image);
      return {
        inState,
        article: {
          id: `news-${i}-${Date.now()}`,
          title: a.title,
          summary: a.description || a.content?.slice(0, 200) || "",
          source: a.sourceName || "News",
          publishedAt: a.publishedAt,
          url: a.url || "#",
          imageUrl: image.url,
          imageIsStock: image.isStock,
          category,
          relevantCrop,
        } as NewsArticle,
      };
    })
    .filter((s) => s.article.category !== "general" && CORE_AGRI.test(s.article.title));

  const rank = (s: (typeof scored)[number]) => {
    if (s.article.category === "crop") return 0;
    if (s.inState) return 1;
    if (s.article.category === "oilseed") return 2;
    return 3;
  };
  scored.sort((a, b) => rank(a) - rank(b));

  return scored.slice(0, 18).map((s) => s.article);
}

// ── GNews.io (works from a deployed origin — the production provider) ──────────

/**
 * GNews free tier: 100 requests/day, up to 10 articles each, and — unlike
 * NewsAPI's free plan — it serves requests from any origin. `country=in` keeps
 * results to Indian outlets; `in=title,description` scopes the search so a story
 * that only name-drops a crop in the body doesn't match.
 *
 * Kept to two calls (one when the farmer has no crops) to stay well inside the
 * daily budget once this is deployed.
 */
async function fetchGNews(
  farmerCrops: string[],
  state: string,
  key: string
): Promise<NewsArticle[]> {
  const hasState = !!state && state.toLowerCase() !== "india";
  const build = (q: string) =>
    `${GNEWS_URL}?q=${encodeURIComponent(q)}&lang=en&country=in&in=title,description&sortby=publishedAt&max=10&apikey=${key}`;

  const queries: string[] = [];

  if (farmerCrops.length > 0) {
    const crops = "(" + farmerCrops.map((c) => `"${c}"`).join(" OR ") + ")";
    queries.push(build(`${crops} AND (${CTX})`));
  }

  const agri =
    '(agriculture OR farmers OR farming OR crop OR kharif OR rabi OR MSP OR mandi OR "crop insurance" OR "PM-KISAN" OR irrigation OR fertiliser OR oilseed OR "edible oil")';
  queries.push(build(hasState ? `${agri} AND ("${state}" OR India)` : `${agri} AND India`));

  const batches = await Promise.all(
    queries.map(async (url): Promise<RawItem[]> => {
      try {
        const res = await fetch(url, { next: { revalidate: REVALIDATE } });
        if (!res.ok) {
          console.warn(`GNews query: HTTP ${res.status}`);
          return [];
        }
        const data = await res.json();
        const list: any[] = Array.isArray(data?.articles) ? data.articles : [];
        return list.map((a) => ({
          title: a.title ?? "",
          description: a.description ?? "",
          content: a.content ?? "",
          url: a.url ?? "#",
          image: a.image ?? null,
          publishedAt: a.publishedAt ?? new Date().toISOString(),
          sourceName: a.source?.name ?? "News",
        }));
      } catch (e) {
        console.warn("GNews query failed:", e);
        return [];
      }
    })
  );

  return rankArticles(batches.flat(), farmerCrops, state);
}

// ── NewsAPI.org (secondary — free plan only serves localhost) ─────────────────

type Tag = "crop" | "farming" | "oilseed" | "state";

async function fetchNewsApi(
  farmerCrops: string[],
  state: string,
  key: string
): Promise<NewsArticle[]> {
  const common = `language=en&sortBy=publishedAt&domains=${NEWSAPI_DOMAINS}&apiKey=${key}`;
  const build = (params: string) => `${NEWSAPI_URL}?${params}&${common}`;
  const hasState = !!state && state.toLowerCase() !== "india";

  // Every query matches in the HEADLINE (`qInTitle`). Body matching pulls in far
  // more, but most of it is corporate/markets copy — headline-scoping is the
  // single biggest lever on quality.
  const queries: { tag: Tag; url: string }[] = [];

  if (farmerCrops.length > 0) {
    const crops = farmerCrops.map((c) => `"${c}"`).join(" OR ");
    queries.push({
      tag: "crop",
      url: build(`qInTitle=${encodeURIComponent(`(${crops}) AND (${CTX})`)}&pageSize=12`),
    });
  }

  queries.push({
    tag: "farming",
    url: build(
      `qInTitle=${encodeURIComponent(
        `agriculture OR agri OR farmer OR farmers OR farming OR kharif OR rabi OR MSP OR mandi OR "crop insurance" OR PM-KISAN OR irrigation OR fertiliser OR fertilizer OR horticulture OR foodgrain OR "crop loan" OR sowing OR acreage OR agrarian`
      )}&pageSize=12`
    ),
  });

  queries.push({
    tag: "oilseed",
    url: build(
      `qInTitle=${encodeURIComponent(
        `(oilseed OR oilseeds OR mustard OR soybean OR groundnut OR sunflower OR sesame OR "edible oil" OR "palm oil") AND (${CTX} OR import OR imports OR crushing OR stock)`
      )}&pageSize=6`
    ),
  });

  if (hasState) {
    queries.push({
      tag: "state",
      url: build(
        `qInTitle=${encodeURIComponent(
          `"${state}" AND (${CTX} OR agriculture OR irrigation OR drought OR rainfall OR monsoon OR flood)`
        )}&pageSize=6`
      ),
    });
  }

  const batches = await Promise.all(
    queries.map(async ({ tag, url }): Promise<RawItem[]> => {
      try {
        const res = await fetch(url, { next: { revalidate: REVALIDATE } });
        if (!res.ok) {
          console.warn(`NewsAPI ${tag} query: HTTP ${res.status}`);
          return [];
        }
        const data = await res.json();
        const list: any[] = Array.isArray(data?.articles) ? data.articles : [];
        return list.map((a) => ({
          title: a.title ?? "",
          description: a.description ?? "",
          content: a.content ?? "",
          url: a.url ?? "#",
          image: a.urlToImage ?? null,
          publishedAt: a.publishedAt ?? new Date().toISOString(),
          sourceName: a.source?.name ?? "News",
        }));
      } catch (e) {
        console.warn(`NewsAPI ${tag} query failed:`, e);
        return [];
      }
    })
  );

  return rankArticles(batches.flat(), farmerCrops, state);
}

// ── TinyFish Search (the live-web tier) ──────────────────────────────────────

/**
 * Last resort, and the only one that stays honest.
 *
 * What used to sit here was a Groq call that *wrote* plausible farming
 * headlines — invented outlets, invented timestamps counted backwards from now,
 * and `url: "#"` so nothing could be clicked and checked. It was labelled "AI
 * Generated" in the UI, which is not the same as being true. This app already
 * deleted one generator of fictional data (`src/lib/stores.ts` and its invented
 * shops); a news feed a farmer might act on is the last place to keep another.
 *
 * TinyFish Search is free and returns real articles with real URLs and real
 * publication dates, so the fallback can be a live web search instead of a
 * fabrication. Three queries, widening from the farmer's own crops to the
 * country, because a farmer growing nothing listed should still see a page.
 *
 * Results go through the same `rankArticles` as GNews and NewsAPI — the same
 * dedupe, the same CORE_AGRI headline gate, the same cap. A cheaper source does
 * not get a lower bar.
 */
async function fetchTinyFishNews(farmerCrops: string[], state: string): Promise<NewsArticle[]> {
  const hasState = !!state && state.toLowerCase() !== "india";

  const queries: string[] = [];
  if (farmerCrops.length) {
    queries.push(`${farmerCrops.slice(0, 3).join(" OR ")} farmer mandi price MSP`);
  }
  if (hasState) {
    queries.push(`${state} agriculture farmers kharif rabi irrigation`);
  }
  queries.push("India agriculture farmers MSP mandi crop insurance PM-KISAN");

  const batches = await Promise.all(
    queries.map((query) =>
      tfSearch(query, {
        domainType: "news",
        location: "IN",
        language: "en",
        // 72 hours. Long enough that a quiet news day still fills the page,
        // short enough that nothing stale reaches a farmer as "news".
        recencyMinutes: 72 * 60,
        label: "tf/news",
      })
    )
  );

  const raw: RawItem[] = batches.flat().map((r) => ({
    title: r.title,
    description: r.snippet,
    url: r.url,
    // Search returns no images. The stock pool fills in, flagged as stock.
    image: null,
    publishedAt: toIsoDate(r.date),
    sourceName: r.site_name,
  }));

  return rankArticles(raw, farmerCrops, state);
}

/**
 * Search dates arrive as "5 Jun 2026", "3 weeks ago", or not at all.
 *
 * An unparseable date returns "" and NOT today's timestamp. Stamping `now()` is
 * exactly what the deleted Groq tier did, and it manufactured recency for
 * stories that might be a year old. The card renders "" as "Date not given",
 * which is the true statement.
 */
function toIsoDate(date: string | undefined): string {
  if (!date) return "";
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

export async function POST(req: Request) {
  // Counted first — every provider path spends an API quota or Groq tokens.
  const rl = await checkRateLimit(req, "news");
  if (!rl.ok) return rateLimited(rl);

  const gnewsKey = process.env.GNEWS_API_KEY;
  const newsApiKey = process.env.NEWS_API_KEY;
  const tinyFishKey = anyKeyConfigured();

  try {
    let body: any = {};
    try {
      body = await readJsonBounded(req, 8_000);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return payloadTooLarge();
      /* malformed JSON — fall through with the empty default */
    }
    const farmerCrops: string[] = clampArr<unknown>(body.farmerCrops, 12)
      .map((c) => clampStr(c, 40))
      .filter(Boolean);
    const state: string = clampStr(body.state, 40) || "India";
    const locale: Locale = LOCALES.some((l) => l.code === body.locale) ? body.locale : "en";

    let articles: NewsArticle[] = [];
    // There is no "ai" source any more: every article the app serves is a real
    // article from a real publisher, whichever tier found it.
    let source: "live" | "search" | "error" = "error";
    let provider: string | null = null;

    // A real-news provider is kept only if it returns enough to fill the page.
    // Below that we fall through to the next one rather than show a 2-item stub.
    const enough = (n: number, moreFallbacks: boolean) => n >= 4 || (n > 0 && !moreFallbacks);

    // GNews first, despite TinyFish Search being free: it supplies the
    // publisher's own images and reliable timestamps, and Search supplies
    // neither. Cheapness does not outrank the better article.
    if (gnewsKey) {
      const real = await fetchGNews(farmerCrops, state, gnewsKey);
      if (enough(real.length, !!newsApiKey || !!tinyFishKey)) {
        articles = real;
        source = "live";
        provider = "GNews";
      }
    }

    if (articles.length === 0 && newsApiKey) {
      const real = await fetchNewsApi(farmerCrops, state, newsApiKey);
      if (enough(real.length, !!tinyFishKey)) {
        articles = real;
        source = "live";
        provider = "NewsAPI";
      }
    }

    if (articles.length === 0 && tinyFishKey) {
      const real = await fetchTinyFishNews(farmerCrops, state);
      if (real.length > 0) {
        articles = real;
        source = "search";
        provider = "TinyFish Search";
      }
    }

    if (articles.length === 0) {
      return NextResponse.json({ articles: [], source: "error", provider: null });
    }

    // Ranking ran on the English text; translate only what is shown.
    // translateMany is a no-op (no network) for locales MT isn't enabled for.
    if (articles.length > 0 && locale !== "en") {
      const out = await translateMany(articles.flatMap((a) => [a.title, a.summary]), locale);
      articles = articles.map((a, i) => ({ ...a, title: out[2 * i], summary: out[2 * i + 1] }));
    }

    return NextResponse.json({ articles, source, provider });
  } catch (e: any) {
    console.error("News API error:", e);
    return NextResponse.json(
      { articles: [], source: "error", provider: null, error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
