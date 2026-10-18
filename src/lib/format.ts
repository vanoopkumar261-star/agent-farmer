import type { Locale } from "./i18n/config";

/**
 * How money, volumes and dates are written. One place.
 *
 * Before this file there were **six byte-identical copies** of `rupee` (in
 * `AnalyticsCard`, `ExpenseCharts`, `LiveMandiCard`, `MarketBoard`,
 * `TransactionPanel`, `TransportPlanner`), nine distinct currency mechanisms in
 * all, and six date formats. The result was visible to farmers rather than just
 * untidy: the expenses page rendered the same money two ways on one screen —
 * `StatTile` went through `CountUp`, which called `toLocaleString(undefined)`
 * and so printed **₹1,250,000** on a phone set to en-US, directly above a
 * ledger printing **₹12,50,000**. Elsewhere `IrrigationLog` printed
 * `₹1250000` with no separator at all, and the transaction ledger printed a
 * raw ISO string (`Seeds · 2026-10-18`).
 *
 * Indian digit grouping (lakh/crore) is not optional here. `en-IN` gives
 * `12,50,000`; the browser default gives `1,250,000` to a farmer who reads the
 * first as obviously correct.
 */

/**
 * App locale → BCP-47 tag.
 *
 * Every locale this app ships is an Indian one, so each maps to its `-IN`
 * region: that keeps lakh/crore grouping and Indian date order no matter which
 * language is selected, and it is why `"en"` becomes `en-IN` and never `en-US`.
 *
 * Five modules hardcoded `"en-US"` — the home greeting, the forecast weekday,
 * the harvest label, the expenses chart month and the market sparkline — so
 * those strings were English in all nine languages.
 */
const BCP47: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  pa: "pa-IN",
};

export function bcp47(locale?: string): string {
  return BCP47[(locale ?? "en") as Locale] ?? "en-IN";
}

// Built once. The old copies constructed a formatter on every render, inside
// `.map()` over a ledger.
const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const INR_2DP = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `₹12,50,000` — the default for any amount shown to a farmer. */
export function rupee(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${INR.format(Math.round(n))}`;
}

/** `₹37.50` — only where paise genuinely matter, such as per-quintal APMC fees. */
export function rupeePaise(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${INR_2DP.format(n)}`;
}

/**
 * `₹12.5k` / `₹1.3Cr` — for chart axes and tiles, where the full number does
 * not fit. Rounded, unlike one of the old inline versions which produced
 * `₹12.5k` and `₹0.5k` from an unrounded divide.
 */
export function rupeeShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1000) return `${sign}₹${Math.round(a / 1000)}k`;
  return `${sign}₹${Math.round(a)}`;
}

/**
 * `900 L` / `12k L`.
 *
 * One rule, because the irrigation page previously showed both forms at once:
 * `IrrigationCard` and `IrrigationVerdictCard` abbreviated above 1,000 while
 * `IrrigationSchedule`, `IrrigationLog` and `RainfedAdvisory` printed the full
 * grouped number. The threshold is 10,000 — below that the digits are still
 * readable, and a farmer filling a 4,000-litre tank wants to see 4,000.
 */
export function litres(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M L`;
  if (v >= 1e4) return `${Math.round(v / 1000).toLocaleString("en-IN")}k L`;
  return `${INR.format(v)} L`;
}

/** `18 Oct 2026`, in the farmer's language. */
export function formatDate(value: string | Date, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return d.toLocaleDateString(bcp47(locale), { day: "numeric", month: "short", year: "numeric" });
}

/** `18 Oct` — for dense rows where the year is obvious from context. */
export function formatDayMonth(value: string | Date, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return d.toLocaleDateString(bcp47(locale), { day: "numeric", month: "short" });
}

/** `02:30 pm`, in the farmer's language. */
export function formatTime(value: string | Date, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(bcp47(locale), { hour: "2-digit", minute: "2-digit" });
}

/** `Saturday, 18 October` — the home-page greeting line. */
export function formatLongDate(value: string | Date, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(bcp47(locale), { weekday: "long", day: "numeric", month: "long" });
}

/** `Sat` — forecast strips and chart axes. */
export function formatWeekday(value: string | Date, locale?: string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(bcp47(locale), { weekday: "short" });
}
