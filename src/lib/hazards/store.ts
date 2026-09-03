import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HazardAlert } from "./types";

/**
 * Persistence for hazard events.
 *
 * Runs with the service-role key, not a farmer session: the poller is a cron
 * job with no signed-in user, and `hazard_events` is shared reference data that
 * only the service role may write (migration 022, same ownership model as
 * `mandi_geocache` in 008).
 *
 * Everything here degrades to a no-op before 022 is applied, matching
 * `notifications-server.ts`. A missing table must never break the dashboard.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hazardAdmin(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Which of these guids are already stored.
 *
 * This is the whole reason a 10-minute poll is cheap. The RSS index is one
 * request; the per-alert CAP document is a request each, and re-fetching all 99
 * every tick would be ~14k requests a day at SACHET for no new information.
 * Only genuinely new guids get a detail fetch.
 */
export async function knownGuids(
  admin: SupabaseClient,
  source: string,
  guids: string[]
): Promise<Set<string>> {
  if (guids.length === 0) return new Set();
  try {
    const { data, error } = await admin
      .from("hazard_events")
      .select("source_guid")
      .eq("source", source)
      .in("source_guid", guids);
    if (error || !data) return new Set();
    return new Set(data.map((r: { source_guid: string }) => r.source_guid));
  } catch {
    // Table may not exist yet. Returning empty means everything looks new and
    // the insert below no-ops too, so the run is a harmless full pass.
    return new Set();
  }
}

/**
 * Upsert alerts, keyed on (source, source_guid).
 *
 * Upsert rather than insert because CAP `msgType: "Update"` reissues an alert
 * under the same guid with a revised expiry — the farmer should see the current
 * version, not the first one received.
 *
 * Returns the number of rows written, or 0 if the table is absent.
 */
export async function storeHazards(
  admin: SupabaseClient,
  alerts: HazardAlert[]
): Promise<number> {
  if (alerts.length === 0) return 0;
  const rows = alerts.map((a) => ({
    source: a.source,
    source_guid: a.sourceGuid,
    event: a.event,
    severity: a.severity,
    certainty: a.certainty ?? null,
    urgency: a.urgency ?? null,
    headline: a.headline,
    instruction: a.instruction ?? null,
    sender: a.sender ?? null,
    districts: a.districts,
    state: a.state ?? null,
    onset: a.onset ?? null,
    expires: a.expires ?? null,
    raw: a.raw ?? null,
  }));

  try {
    const { error, count } = await admin
      .from("hazard_events")
      .upsert(rows, { onConflict: "source,source_guid", count: "exact" });
    if (error) {
      console.error("HAZARD store error:", error.message);
      return 0;
    }
    return count ?? rows.length;
  } catch (e: any) {
    console.error("HAZARD store failed:", e?.message ?? e);
    return 0;
  }
}

/**
 * Drop events that expired more than a day ago.
 *
 * Kept for a day past expiry rather than deleted on the dot so a farmer opening
 * the app in the evening still sees what was warned about that afternoon, and
 * so a post-incident question ("was I told?") has an answer.
 */
export async function pruneExpired(admin: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { error, count } = await admin
      .from("hazard_events")
      .delete({ count: "exact" })
      .lt("expires", cutoff);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
