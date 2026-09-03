import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

/**
 * Server-side geocoding proxy for the onboarding house-location map picker.
 *
 * The browser can't call Nominatim directly: the app CSP is `connect-src 'self'`,
 * and Nominatim's usage policy requires an identifying User-Agent and rate
 * limiting that a fan-out of farmer browsers would violate (and get the app's
 * users soft-blocked). Routing through here keeps the CSP tight, sends a proper
 * UA, caches results, and applies our own rate limit.
 *
 *   forward:  /api/geocode?q=<address|village|6-digit PIN>
 *   reverse:  /api/geocode?lat=<lat>&lng=<lng>
 *
 * Response: { lat?, lng?, address?, pincode?, error? }
 */

export const dynamic = "force-dynamic";

const NOMINATIM = "https://nominatim.openstreetmap.org";
// Nominatim asks for an identifying UA with contact info.
const UA = "AgentFarmer/1.0 (farmer onboarding location picker; +https://github.com/)";

type GeoOut = {
  lat?: number;
  lng?: number;
  address?: string;
  pincode?: string;
  /**
   * Administrative district and state. Nominatim already returns these in the
   * `addressdetails` payload this route requests; they used to be dropped on
   * the floor. The hazard early-warning check matches official IMD/CWC warnings
   * to a farmer by district name, so it needs them.
   *
   * Nominatim's field naming for districts is inconsistent across India — some
   * places carry `state_district`, others only `county` — hence the fallback
   * chain where these are read.
   */
  district?: string;
  state?: string;
  error?: string;
};

/** Pull the district/state out of a Nominatim `address` object. */
function adminAreas(a: any): { district?: string; state?: string } {
  if (!a) return {};
  return {
    district: a.state_district || a.county || a.district || undefined,
    state: a.state || undefined,
  };
}

async function nominatim(path: string): Promise<any> {
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 86_400 }, // a PIN / coordinate doesn't move
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "geocode");
  if (!rl.ok) return rateLimited(rl);

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);

  try {
    // ── Reverse ──────────────────────────────────────────────────────────────
    if (lat != null && lng != null) {
      const la = Number(lat);
      const lo = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
        return NextResponse.json({ error: "invalid coordinates" } satisfies GeoOut, { status: 400 });
      }
      const d = await nominatim(`/reverse?format=json&addressdetails=1&lat=${la}&lon=${lo}`);
      return NextResponse.json({
        lat: la,
        lng: lo,
        address: (d?.display_name as string) || undefined,
        pincode: (d?.address?.postcode as string) || undefined,
        ...adminAreas(d?.address),
      } satisfies GeoOut);
    }

    // ── Forward ──────────────────────────────────────────────────────────────
    if (!q) {
      return NextResponse.json({ error: "empty query" } satisfies GeoOut, { status: 400 });
    }

    const isPin = /^\d{6}$/.test(q);
    const base = "/search?format=json&addressdetails=1&limit=1&countrycodes=in";
    const attempts = isPin
      ? [
          `${base}&postalcode=${encodeURIComponent(q)}`,
          `${base}&q=${encodeURIComponent(`${q} India`)}`,
        ]
      : [`${base}&q=${encodeURIComponent(q)}`];

    for (const p of attempts) {
      const arr = await nominatim(p);
      if (Array.isArray(arr) && arr.length > 0) {
        const f = arr[0];
        return NextResponse.json({
          lat: parseFloat(f.lat),
          lng: parseFloat(f.lon),
          address: (f.display_name as string) || undefined,
          pincode: (f.address?.postcode as string) || (isPin ? q : undefined),
          ...adminAreas(f.address),
        } satisfies GeoOut);
      }
    }

    return NextResponse.json({ error: "not found" } satisfies GeoOut, { status: 404 });
  } catch (e: any) {
    console.error("geocode error:", e?.message ?? e);
    return NextResponse.json({ error: "geocode failed" } satisfies GeoOut, { status: 502 });
  }
}
