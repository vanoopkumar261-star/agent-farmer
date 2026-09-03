import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { checkHazards } from "@/lib/hazards/check";

/**
 * "Are there emergency alerts over my land right now?"
 *
 * Backs the Alerts-card popup on the web dashboard and the same popup in the
 * mobile app. Both call this one route — the district matching lives here
 * rather than in either client so the two apps cannot drift into giving the
 * same farmer different answers about a storm.
 *
 * Auth comes from `createSupabaseServer()`, which reads the session cookie on
 * the web and an `Authorization: Bearer` token from the Expo app. The farmer's
 * own profile is looked up under RLS, so this can only ever answer about the
 * caller's own location — a farmer id is never accepted from the request.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "hazard-check");
  if (!rl.ok) return rateLimited(rl);

  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("farmer_profiles")
    .select("id, house_address, house_district, house_state, house_lat, house_lng")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("HAZARD check profile error:", error.message);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!profile) {
    // Signed in but not onboarded — no location to check against.
    return NextResponse.json(
      {
        district: null,
        state: null,
        outline: null,
        home: null,
        checkedAt: new Date().toISOString(),
        freshness: "cached",
        dataAsOf: null,
        red: [],
        orange: [],
        yellow: [],
        reason: "no-location",
      },
      { status: 200 }
    );
  }

  try {
    const result = await checkHazards(supabase, profile as any);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("HAZARD check failed:", e?.message ?? e);
    return NextResponse.json({ error: "check failed" }, { status: 500 });
  }
}
