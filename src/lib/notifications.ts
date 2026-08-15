import { supabase } from "./supabase";

/**
 * Client-side notification access (browser Supabase client, RLS-scoped).
 * Graceful: returns empty / no-ops before migration 006 is applied.
 */

export type NotificationRow = {
  id: string;
  dedupe_key: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export async function loadNotifications(farmerId: string, limit = 15): Promise<NotificationRow[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as NotificationRow[];
  } catch {
    return [];
  }
}

export async function markAllRead(farmerId: string): Promise<void> {
  try {
    await supabase.from("notifications").update({ read: true }).eq("farmer_id", farmerId).eq("read", false);
  } catch {
    /* table may not exist yet */
  }
}
