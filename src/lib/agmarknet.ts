import "server-only";

/**
 * Live mandi prices from the Government of India open-data (data.gov.in)
 * Agmarknet resource: "Current Daily Price of Various Commodities from Various
 * Markets (Mandi)". Prices are ₹ per quintal. This resource carries the latest
 * daily snapshot only (no historical series).
 *
 * Robust by design: returns [] on a missing key, network error, or bad payload,
 * so callers can fall back to estimated data without special-casing failure.
 */

const RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

export type MandiRecord = {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrivalDate: string;
  min: number;
  max: number;
  modal: number;
};

function toNum(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function fetchAgmarknet({
  state,
  limit = 1000,
}: {
  state?: string;
  limit?: number;
}): Promise<MandiRecord[]> {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      "api-key": key,
      format: "json",
      limit: String(limit),
    });
    if (state) params.set("filters[state]", state);

    const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?${params.toString()}`;
    // Cache for 6 hours — mandi prices update at most once a day.
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) return [];

    const json = await res.json();
    const records = (json?.records ?? []) as any[];

    return records
      .map((r) => ({
        state: r.state ?? "",
        district: r.district ?? "",
        market: r.market ?? "",
        commodity: r.commodity ?? "",
        variety: r.variety ?? "",
        grade: r.grade ?? "",
        arrivalDate: r.arrival_date ?? "",
        min: toNum(r.min_price),
        max: toNum(r.max_price),
        modal: toNum(r.modal_price),
      }))
      .filter((r) => r.modal > 0 && r.market);
  } catch (e) {
    console.error("AGMARKNET error:", e);
    return [];
  }
}
