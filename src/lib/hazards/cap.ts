import "server-only";
import { isSeverity, type HazardAlert, type HazardSeverity } from "./types";

/**
 * NDMA SACHET — India's official disaster alert feed.
 *
 * SACHET aggregates the Common Alerting Protocol (CAP) warnings issued by IMD's
 * regional offices, the Central Water Commission, INCOIS and the state disaster
 * management authorities. It is open: no key, no registration, no IP
 * whitelisting. IMD's own API (api.imd.gov.in) requires all three, and a survey
 * of a full feed found every single alert came from IMD or CWC anyway — so this
 * is the same warning stream, reachable from serverless functions.
 *
 * Two-step fetch. The RSS index carries headlines only; the structured fields
 * that matter (severity, certainty, onset, expires, the issuing agency's own
 * instruction) live in a per-alert CAP document. We fetch that second document
 * only for a guid we have not already stored, which keeps a 10-minute poll at
 * roughly one 60 KB request.
 *
 * Deliberately no XML dependency: these documents are small and regular, the
 * repo has no parser today, and adding one to read four fields is not worth the
 * supply-chain surface. If SACHET ever emits nested or attribute-bearing CAP,
 * revisit — but the extractor below fails loudly rather than silently.
 *
 * Known limit: cap:area carries no polygon. The separate polygon endpoint
 * (FetchPolygonXMLFile) returns 403 to any client we can be, so geo-matching is
 * by district name parsed from the headline. See match.ts.
 */

const FEED_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml";

/** Identify ourselves, as we already do for Nominatim in /api/geocode. */
const UA = "AgentFarmer/1.0 (farmer hazard early-warning; +https://github.com/)";

const FETCH_TIMEOUT_MS = 15_000;

export type CapFeedItem = {
  guid: string;
  title: string;
  /** "IMD Kolkata", "CWC" — parsed out of the RSS <author>. */
  sender?: string;
  /** CAP XML document for this alert. */
  link: string;
  pubDate?: string;
  category?: string;
};

/** Minimal XML entity decoding — these feeds use the predefined five only. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    // Ampersand last, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, "&");
}

/**
 * First value of `<tag>` (with or without a namespace prefix), trimmed.
 * Returns undefined for a self-closing or empty element, which CAP uses
 * liberally — `<cap:description/>` appears on most real alerts.
 */
function tag(xml: string, name: string): string | undefined {
  const re = new RegExp(
    `<(?:[A-Za-z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${name}>`,
    "i"
  );
  const raw = re.exec(xml)?.[1];
  if (raw == null) return undefined;
  const val = decodeEntities(raw).trim();
  return val.length > 0 ? val : undefined;
}

async function get(url: string): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml, text/xml, */*" },
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.error(`CAP fetch ${res.status}: ${url}`);
      return null;
    }
    return await res.text();
  } catch (e: any) {
    console.error(`CAP fetch failed: ${url} — ${e?.message ?? e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The alert index. Returns [] on any upstream failure — never throws. */
export async function fetchCapFeed(): Promise<CapFeedItem[]> {
  const xml = await get(FEED_URL);
  if (!xml) return [];

  const items: CapFeedItem[] = [];
  // exec loop rather than matchAll: the project's tsc target does not enable
  // downlevelIteration, and this needs no iterator.
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const guid = tag(block, "guid");
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!guid || !title || !link) continue;

    // <author> is "controlroom@ndma.gov.in (IMD Patna)" — the agency is the
    // part in parentheses, and it is the only place the issuer appears.
    const author = tag(block, "author");
    const sender = author ? /\(([^)]+)\)/.exec(author)?.[1]?.trim() : undefined;

    items.push({
      guid,
      title,
      link,
      sender,
      pubDate: tag(block, "pubDate"),
      category: tag(block, "category"),
    });
  }
  return items;
}

/**
 * The structured CAP document for one alert.
 *
 * Falls back to the feed item's own headline and sender when the detail fetch
 * fails, so a transient upstream error downgrades the alert's precision rather
 * than dropping a real warning on the floor.
 */
export async function fetchCapAlert(item: CapFeedItem): Promise<HazardAlert> {
  const xml = await get(item.link);

  const fallback: HazardAlert = {
    source: "cap",
    tier: "official",
    sourceGuid: item.guid,
    event: item.category ?? "Weather warning",
    severity: "Unknown",
    headline: item.title,
    sender: item.sender,
    districts: [],
  };
  if (!xml) return fallback;

  const rawSeverity = tag(xml, "severity") ?? "Unknown";
  const severity: HazardSeverity = isSeverity(rawSeverity) ? rawSeverity : "Unknown";

  return {
    source: "cap",
    tier: "official",
    sourceGuid: item.guid,
    event: tag(xml, "event") ?? fallback.event,
    severity,
    certainty: tag(xml, "certainty"),
    urgency: tag(xml, "urgency"),
    // Prefer the CAP headline: the RSS title is sometimes the Hindi variant.
    headline: tag(xml, "headline") ?? item.title,
    instruction: tag(xml, "instruction"),
    // cap:sender is a machine id ("West-Bengal-SDMA"); the RSS author is the
    // human-readable office ("IMD Kolkata"), which is what a farmer should see.
    sender: item.sender ?? tag(xml, "sender"),
    districts: [],
    onset: tag(xml, "onset") ?? tag(xml, "effective"),
    expires: tag(xml, "expires"),
    raw: {
      identifier: tag(xml, "identifier"),
      capSender: tag(xml, "sender"),
      status: tag(xml, "status"),
      msgType: tag(xml, "msgType"),
      areaDesc: tag(xml, "areaDesc"),
      language: tag(xml, "language"),
      rssTitle: item.title,
      pubDate: item.pubDate,
    },
  };
}
