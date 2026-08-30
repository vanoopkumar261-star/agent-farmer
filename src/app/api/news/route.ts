import { NextResponse } from "next/server";
import { fetchWithRetry, readGroqContent, GROQ_TEXT_MODEL } from "@/lib/http";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { clampArr, clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
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

function pickImage(title: string, apiImage: string | null): string {
  // Try API image first - only use if it's a real image URL (not a placeholder)
  if (
    apiImage &&
    apiImage.startsWith("http") &&
    !apiImage.includes("placeholder") &&
    !apiImage.includes("via.placeholder") &&
    !apiImage.includes("null")
  ) {
    return apiImage;
  }

  // Match keywords in title to themed farming images
  const lower = title.toLowerCase();
  for (const [keyword, url] of Object.entries(FARMING_IMAGES)) {
    if (lower.includes(keyword)) return url;
  }
  return FARMING_IMAGES.default;
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
      return {
        inState,
        article: {
          id: `news-${i}-${Date.now()}`,
          title: a.title,
          summary: a.description || a.content?.slice(0, 200) || "",
          source: a.sourceName || "News",
          publishedAt: a.publishedAt,
          url: a.url || "#",
          imageUrl: pickImage(a.title, a.image),
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

// ── Groq fallback ─────────────────────────────────────────────────────────────
// Used only when no news provider is configured or all of them return too
// little. The result is clearly labelled "AI Generated" in the UI, so it must
// never be mixed into a real-news response.
async function generateFallbackNews(
  farmerCrops: string[],
  state: string,
  groqKey: string
): Promise<NewsArticle[]> {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const crops = farmerCrops.join(", ") || "wheat, paddy";
  const prompt = `You are an Indian agricultural news writer. Write 8 realistic, plausible Indian farming news items dated around ${today}.

Farmer's crops: ${crops}
Farmer's region: ${state || "India"}

Cover, in this priority order:
1. Two items about the farmer's crops (${crops}) — MSP, mandi arrivals and prices, production/acreage updates${state ? `, ideally set in or near ${state}` : ""}.
2. Two items about oilseeds in India (mustard, soybean, groundnut, sunflower) — edible-oil prices, imports, the crushing industry.
3. Two items about Indian agriculture generally — monsoon and rainfall, irrigation, PM-KISAN, soil health, crop insurance.
4. Two items about government schemes and policy — MSP decisions, APMC/eNAM reform, subsidies, PMFBY, Kisan Credit Card, FPOs.

Rules:
- Every item must be India-specific. Name real states, districts and mandis.
- Reference schemes and bodies that exist: PM-KISAN, PMFBY, eNAM, Kisan Credit Card, NABARD, FCI, ICAR, APEDA.
- Use realistic rupee figures and the correct season names (Rabi, Kharif, Zaid). Do not state a precise MSP figure as fact — describe it in approximate terms.

Return ONLY a JSON array, no markdown:
[
  {
    "title": "headline, under 12 words, Indian agriculture focused",
    "summary": "2-3 sentence summary with concrete Indian detail and approximate rupee figures",
    "source": "a real Indian outlet: 'The Hindu BusinessLine', 'Economic Times', 'Krishi Jagran', 'LiveMint', 'Down To Earth', 'Indian Express', 'Business Standard'",
    "category": "crop" | "oilseed" | "farming" | "general",
    "relevantCrop": "crop name or null",
    "imageKeyword": "one of: wheat paddy maize tomato onion potato cotton sugarcane soybean sunflower mustard groundnut farmer market mandi rain drought harvest soil irrigation scheme government"
  }
]`;

  let raw: string;
  try {
    const res = await fetchWithRetry(
      GROQ_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [
            { role: "system", content: "You are a precise Indian agriculture news writer. Return valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      },
      { label: "news/groq" }
    );
    raw = await readGroqContent(res, "news/groq");
  } catch (e) {
    console.error("News Groq fallback failed:", e);
    return [];
  }

  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = cleaned.indexOf("[");
    const b = cleaned.lastIndexOf("]");
    const list = JSON.parse(a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned);
    const articles: any[] = Array.isArray(list) ? list : list.articles ?? list.news ?? [];

    return articles.map((it: any, i: number) => ({
      id: `groq-${i}-${Date.now()}`,
      title: it.title,
      summary: it.summary,
      source: it.source,
      publishedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
      url: "#",
      imageUrl: FARMING_IMAGES[it.imageKeyword as keyof typeof FARMING_IMAGES] ?? FARMING_IMAGES.default,
      category: it.category,
      relevantCrop: it.relevantCrop ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  // Counted first — every provider path spends an API quota or Groq tokens.
  const rl = await checkRateLimit(req, "news");
  if (!rl.ok) return rateLimited(rl);

  const gnewsKey = process.env.GNEWS_API_KEY;
  const newsApiKey = process.env.NEWS_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

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

    let articles: NewsArticle[] = [];
    let source: "live" | "ai" | "error" = "error";
    let provider: string | null = null;

    // A real-news provider is kept only if it returns enough to fill the page.
    // Below that we fall through — to the next provider, then to the AI writer —
    // rather than show a 2-item stub.
    const enough = (n: number, moreFallbacks: boolean) => n >= 4 || (n > 0 && !moreFallbacks);

    if (gnewsKey) {
      const real = await fetchGNews(farmerCrops, state, gnewsKey);
      if (enough(real.length, !!newsApiKey || !!groqKey)) {
        articles = real;
        source = "live";
        provider = "GNews";
      }
    }

    if (articles.length === 0 && newsApiKey) {
      const real = await fetchNewsApi(farmerCrops, state, newsApiKey);
      if (enough(real.length, !!groqKey)) {
        articles = real;
        source = "live";
        provider = "NewsAPI";
      }
    }

    if (articles.length === 0 && groqKey) {
      articles = await generateFallbackNews(farmerCrops, state, groqKey);
      if (articles.length > 0) {
        source = "ai";
        provider = null;
        // The real-news paths already rank; the AI writer needs a tidy-up.
        const priority = { crop: 0, oilseed: 1, farming: 2, general: 3 };
        articles.sort((a, b) => priority[a.category] - priority[b.category]);
      }
    }

    if (articles.length === 0) {
      return NextResponse.json({ articles: [], source: "error", provider: null });
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
