import "server-only";
import { createSupabaseServer } from "./supabase-server";

/**
 * Memory layer — persists what the AI produces so the companion remembers:
 * disease scans (with leaf images) and chat history. Everything degrades
 * gracefully: before migration 005 is applied, writes no-op and reads return
 * empty, so callers never need to special-case a missing table.
 */

export type DiagnosisRecord = {
  id: string;
  crop_name: string | null;
  disease: string | null;
  healthy: boolean;
  confidence: number | null;
  severity: string | null;
  summary: string | null;
  source: string | null;
  image_url: string | null;
  created_at: string;
};

export type ChatRow = { role: "user" | "assistant"; content: string };

/** Upload a leaf image to the public `leaf-scans` bucket. Returns its URL or null. */
export async function uploadLeafImage(
  farmerId: string,
  blob: Blob,
  mime: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseServer();
    const ext = mime.includes("png") ? "png" : "jpg";
    const path = `${farmerId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("leaf-scans")
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("leaf-scans").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function saveDiagnosis(
  farmerId: string,
  d: {
    crop: string;
    disease: string;
    healthy: boolean;
    confidence: number;
    severity: string;
    affectedAreaPct: number;
    summary: string;
    source: string;
    imageUrl: string | null;
  }
): Promise<void> {
  try {
    const supabase = createSupabaseServer();
    await supabase.from("crop_health_records").insert({
      farmer_id: farmerId,
      crop_name: d.crop,
      disease: d.disease,
      healthy: d.healthy,
      confidence: d.confidence,
      severity: d.severity,
      affected_area_pct: d.affectedAreaPct,
      summary: d.summary,
      source: d.source,
      image_url: d.imageUrl,
    });
  } catch {
    /* table may not exist yet — no-op */
  }
}

export async function getRecentDiagnoses(farmerId: string, limit = 10): Promise<DiagnosisRecord[]> {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("crop_health_records")
      .select("id, crop_name, disease, healthy, confidence, severity, summary, source, image_url, created_at")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as DiagnosisRecord[];
  } catch {
    return [];
  }
}

export async function saveChatTurn(
  farmerId: string,
  userText: string,
  assistantText: string
): Promise<void> {
  try {
    const supabase = createSupabaseServer();
    const rows: { farmer_id: string; role: "user" | "assistant"; content: string }[] = [];
    if (userText?.trim()) rows.push({ farmer_id: farmerId, role: "user", content: userText.slice(0, 4000) });
    if (assistantText?.trim())
      rows.push({ farmer_id: farmerId, role: "assistant", content: assistantText.slice(0, 8000) });
    if (rows.length) await supabase.from("chat_messages").insert(rows);
  } catch {
    /* table may not exist yet — no-op */
  }
}

export async function getRecentChat(farmerId: string, limit = 20): Promise<ChatRow[]> {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as ChatRow[]).reverse(); // oldest → newest for display
  } catch {
    return [];
  }
}
