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

const LEAF_BUCKET = "leaf-scans";

/**
 * Uploads a leaf image and returns its **object path**, not a URL.
 *
 * The bucket used to be public and this returned `getPublicUrl`, so the stored
 * value was a credential-free link to a photograph of a farmer's land (see
 * migration 014). Now the path is stored and a short-lived signed URL is minted
 * at render time, which means a leaked database row is no longer a leaked photo.
 */
export async function uploadLeafImage(
  farmerId: string,
  blob: Blob,
  mime: string
): Promise<string | null> {
  try {
    const supabase = createSupabaseServer();
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const path = `${farmerId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(LEAF_BUCKET)
      .upload(path, blob, { contentType: mime, upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Turns a stored `image_url` into a viewable link.
 *
 * Two shapes exist in the table and both have to work. Rows written before
 * migration 014 hold an absolute public URL; rows written after hold a bare
 * object path. Signing a legacy row means recovering the path from inside its
 * URL — without that, every historical scan would 404 the moment the bucket
 * went private, which looks like data loss rather than a security fix.
 *
 * Returns null rather than throwing so one unsignable row cannot take down the
 * whole scan history.
 */
export async function signLeafImage(
  stored: string | null,
  expiresInSec = 3600
): Promise<string | null> {
  if (!stored) return null;

  // `https://…/storage/v1/object/public/leaf-scans/<path>` → `<path>`
  const marker = `/${LEAF_BUCKET}/`;
  const path = stored.startsWith("http")
    ? stored.slice(stored.indexOf(marker) + marker.length).split("?")[0]
    : stored;
  if (!path || (stored.startsWith("http") && !stored.includes(marker))) return null;

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase.storage
      .from(LEAF_BUCKET)
      .createSignedUrl(decodeURIComponent(path), expiresInSec);
    if (error) return null;
    return data?.signedUrl ?? null;
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
