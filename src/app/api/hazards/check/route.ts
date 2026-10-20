import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { checkHazards, type MatchedAlert } from "@/lib/hazards/check";
import { translateMany } from "@/lib/translate";
import { LOCALES, type Locale } from "@/lib/i18n/config";

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

  // NOT createSupabaseServer()'s own `.auth.getUser()` (no-arg) — that reads
  // only the cookie-backed session, which is empty on every mobile request.
  // getSessionUser() explicitly forwards the Bearer token GoTrue needs to
  // verify it; skipping it here previously meant the mobile app's Alerts card
  // 401'd on every check, despite this route claiming Bearer support.
  const user = await getSessionUser();
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

    // Optional `{ locale }` body. Callers that send none (the mobile app today)
    // get the verbatim English, exactly as before.
    const body = await req.json().catch(() => ({}));
    const locale: Locale = LOCALES.some((l) => l.code === body?.locale) ? body.locale : "en";
    if (locale !== "en") {
      const all: MatchedAlert[] = [...result.red, ...result.orange, ...result.yellow];
      const out = await translateMany(all.flatMap((a) => [a.event, a.headline, a.instruction ?? ""]), locale);
      all.forEach((a, i) => {
        a.translated = { event: out[3 * i], headline: out[3 * i + 1], instruction: a.instruction && out[3 * i + 2] };
      });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("HAZARD check failed:", e?.message ?? e);
    return NextResponse.json({ error: "check failed" }, { status: 500 });
  }
}
