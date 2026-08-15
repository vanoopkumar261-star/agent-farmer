import "server-only";
import { createSupabaseServer } from "./supabase-server";

/**
 * Server-side notification generation. Upserts by (farmer_id, dedupe_key) so the
 * same alert/task on the same day is recorded once, not on every page load.
 * Graceful no-op before migration 006 is applied.
 */

export type NotifSeed = { dedupeKey: string; kind: string; title: string; body?: string };

export async function syncNotifications(farmerId: string, seeds: NotifSeed[]): Promise<void> {
  if (!seeds.length) return;
  try {
    const supabase = createSupabaseServer();
    const rows = seeds.map((s) => ({
      farmer_id: farmerId,
      dedupe_key: s.dedupeKey,
      kind: s.kind,
      title: s.title,
      body: s.body ?? null,
    }));
    await supabase.from("notifications").upsert(rows, {
      onConflict: "farmer_id,dedupe_key",
      ignoreDuplicates: true,
    });
  } catch {
    /* table may not exist yet — no-op */
  }
}
