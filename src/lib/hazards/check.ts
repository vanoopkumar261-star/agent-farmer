import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCapAlert, fetchCapFeed } from "./cap";
import { hazardAdmin, knownGuids, storeHazards } from "./store";
import { getDistrictOutline, type DistrictOutline } from "./outline";
import {
  bandFor,
  coversDistrict,
  coversState,
  districtFromAddress,
  type HazardBand,
} from "./match";

/**
 * "Is there an emergency over my land right now?" — answered on demand.
 *
 * The cron poller keeps `hazard_events` current in the background; this reads
 * it, works out which warnings name the farmer's own district, and sorts them
 * onto IMD's colour scale.
 */

/** How stale the store may be before a tap triggers a live pull. */
const STALE_AFTER_MS = 15 * 60 * 1000;
/** Detail fetches allowed during an inline refresh — the farmer is waiting. */
const INLINE_FETCH_CAP = 12;

export type MatchedAlert = {
  band: HazardBand;
  event: string;
  severity: string;
  certainty: string | null;
  urgency: string | null;
  headline: string;
  instruction: string | null;
  sender: string | null;
  onset: string | null;
  expires: string | null;
  /** 'district' when the warning names their district, 'state' for a widened red. */
  matchedOn: "district" | "state";
};

export type HazardCheckResult = {
  district: string | null;
  state: string | null;
  /** District boundary for the severity map. Null degrades to no map. */
  outline: DistrictOutline | null;
  /** The farmer's own coordinates, so the glow sits where they actually are. */
  home: { lat: number; lng: number } | null;
  checkedAt: string;
  freshness: "live" | "cached";
  /** Timestamp of the most recent warning held, so the UI can be honest. */
  dataAsOf: string | null;
  red: MatchedAlert[];
  orange: MatchedAlert[];
  yellow: MatchedAlert[];
  /** Set when we could not work out where the farmer is. */
  reason?: "no-location";
};

type ProfileRow = {
  id: string;
  house_address: string | null;
  house_district: string | null;
  house_state: string | null;
  house_lat: number | null;
  house_lng: number | null;
};

/**
 * The farmer's district, resolved once and remembered.
 *
 * Prefers the stored column; otherwise parses the address already on the
 * profile, which Nominatim wrote at onboarding and which contains the district
 * verbatim — so this costs no geocoding call for any farmer who has completed
 * onboarding. The result is written back so the parse happens at most once.
 */
export async function resolveDistrict(
  supabase: SupabaseClient,
  profile: ProfileRow
): Promise<{ district: string; state: string } | null> {
  if (profile.house_district) {
    return { district: profile.house_district, state: profile.house_state ?? "" };
  }

  const parsed = districtFromAddress(profile.house_address);
  if (!parsed) return null;

  try {
    await supabase
      .from("farmer_profiles")
      .update({ house_district: parsed.district, house_state: parsed.state })
      .eq("id", profile.id);
  } catch {
    // Caching is an optimisation. If the write fails the check still answers,
    // it just re-parses next time.
  }
  return parsed;
}

type EventRow = {
  event: string;
  severity: string;
  certainty: string | null;
  urgency: string | null;
  headline: string;
  instruction: string | null;
  sender: string | null;
  onset: string | null;
  expires: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

/** Newest ingest timestamp, or null when the table is empty/absent. */
async function newestIngest(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("hazard_events")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { created_at: string } | null)?.created_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Pull the feed inline when the store has gone stale.
 *
 * Bounded hard: the farmer is looking at a spinner, so this fetches at most a
 * dozen new alerts and gives up quietly on any failure rather than leaving the
 * popup hanging. A stale answer clearly labelled as stale beats no answer.
 */
async function refreshInline(): Promise<void> {
  const admin = hazardAdmin();
  if (!admin) return;
  try {
    const feed = await fetchCapFeed();
    if (!feed.length) return;
    const seen = await knownGuids(admin, "cap", feed.map((f) => f.guid));
    const fresh = feed.filter((f) => !seen.has(f.guid)).slice(0, INLINE_FETCH_CAP);
    if (!fresh.length) return;
    const alerts = [];
    for (const item of fresh) alerts.push(await fetchCapAlert(item));
    await storeHazards(admin, alerts);
  } catch (e: any) {
    console.error("HAZARD inline refresh failed:", e?.message ?? e);
  }
}

function toMatched(row: EventRow, matchedOn: "district" | "state"): MatchedAlert {
  return {
    band: bandFor(row.severity as any, row.urgency ?? undefined),
    event: row.event,
    severity: row.severity,
    certainty: row.certainty,
    urgency: row.urgency,
    headline: row.headline,
    instruction: row.instruction,
    sender: row.sender,
    onset: row.onset,
    expires: row.expires,
    matchedOn,
  };
}

export async function checkHazards(
  supabase: SupabaseClient,
  profile: ProfileRow
): Promise<HazardCheckResult> {
  const checkedAt = new Date().toISOString();
  const where = await resolveDistrict(supabase, profile);

  if (!where) {
    return {
      district: null,
      state: null,
      outline: null,
      home: null,
      checkedAt,
      freshness: "cached",
      dataAsOf: await newestIngest(supabase),
      red: [],
      orange: [],
      yellow: [],
      reason: "no-location",
    };
  }

  let freshness: "live" | "cached" = "cached";
  const newest = await newestIngest(supabase);
  if (!newest || Date.now() - new Date(newest).getTime() > STALE_AFTER_MS) {
    await refreshInline();
    freshness = "live";
  }

  // Only warnings still in force. An expired warning is history, not an alert.
  let rows: EventRow[] = [];
  try {
    const { data } = await supabase
      .from("hazard_events")
      .select(
        "event,severity,certainty,urgency,headline,instruction,sender,onset,expires,raw,created_at"
      )
      .gt("expires", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    rows = (data ?? []) as EventRow[];
  } catch {
    rows = [];
  }

  const red: MatchedAlert[] = [];
  const orange: MatchedAlert[] = [];
  const yellow: MatchedAlert[] = [];

  for (const row of rows) {
    const band = bandFor(row.severity as any, row.urgency ?? undefined);

    if (coversDistrict(row, where.district)) {
      const m = toMatched(row, "district");
      (band === "red" ? red : band === "orange" ? orange : yellow).push(m);
      continue;
    }

    // State-level widening applies to red only — see coversState() for why
    // doing this for ordinary warnings would be actively harmful.
    if (band === "red" && where.state && coversState(row, where.state)) {
      red.push(toMatched(row, "state"));
    }
  }

  if (red.length || orange.length) {
    console.log(
      `HAZARD match: district=${where.district} red=${red.length} orange=${orange.length} yellow=${yellow.length}`
    );
  }

  // Fetched after the matching so a slow or failed boundary lookup can never
  // delay — or lose — the alerts themselves. Null here just means no map.
  const outline = await getDistrictOutline(where.district, where.state || null);

  const home =
    profile.house_lat != null && profile.house_lng != null
      ? { lat: profile.house_lat, lng: profile.house_lng }
      : null;

  return {
    district: where.district,
    state: where.state || null,
    outline,
    home,
    checkedAt,
    freshness,
    dataAsOf: newest,
    red,
    orange,
    yellow,
  };
}
