import { NextResponse } from "next/server";
import { narrativeFromLabel, diagnoseFromImage, DiseaseResult } from "@/lib/disease";
import { getSessionFarmer, getSessionUser } from "@/lib/auth";
import { checkQuota, consumeQuota, getPlan, planDenied } from "@/lib/entitlements";
import { saveDiagnosis, uploadLeafImage } from "@/lib/history";
import { inferenceBaseUrl } from "@/lib/inference";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { sniffImageType, normalizeImage, ImageRejectedError } from "@/lib/image";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload ceiling.
 *
 * 4 MB, not the bucket's 5 MB (migration 014), because Vercel refuses a request
 * body over 4.5 MB at the platform edge — the function never runs, so a 5 MB
 * limit here could only ever be reached on localhost. Staying under the
 * platform cap means the farmer gets this sentence instead of an opaque 413.
 * The client shrinks photos to a few hundred KB first (src/lib/imageUpload.ts);
 * this is the backstop for when that cannot run.
 */
const MAX_UPLOAD_MB = 4;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const CONFIDENCE_THRESHOLD = 0.6;

/** Persist the scan (image + diagnosis) to the farmer's health timeline. Non-fatal. */
async function persistScan(result: DiseaseResult, bytes: Buffer, mime: string) {
  try {
    const farmer = await getSessionFarmer();
    if (!farmer) return;
    const imageUrl = await uploadLeafImage(farmer.id, new Blob([new Uint8Array(bytes)], { type: mime }), mime);
    await saveDiagnosis(farmer.id, {
      crop: result.crop,
      disease: result.disease,
      healthy: result.healthy,
      confidence: result.confidence,
      severity: result.severity,
      affectedAreaPct: result.affectedAreaPct,
      summary: result.summary,
      source: result.source,
      imageUrl,
    });
  } catch (e) {
    console.error("persistScan failed (non-fatal):", e);
  }
}

export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "disease");
  if (!rl.ok) return rateLimited(rl);

  // SECURITY / BILLING — this route used to accept anonymous uploads, with
  // persistScan simply skipping the save when nobody was signed in. Every call
  // spends Groq vision tokens, and a monthly allowance needs somebody to spend
  // it, so both reasons point the same way: identify the caller first.
  const [farmer, user] = await Promise.all([getSessionFarmer(), getSessionUser()]);
  if (!farmer || !user) {
    return NextResponse.json({ error: "Sign in to scan a leaf." }, { status: 401 });
  }

  const plan = getPlan(farmer);
  const guard = await checkQuota(user.id, "disease_scan", plan);
  if (!guard.ok) return planDenied(guard);

  /**
   * Spend one scan.
   *
   * Called only on a path that produced a diagnosis. A Groq timeout or a
   * rejected image must not consume one of a Krishi Mitra farmer's three
   * scans — they would have paid an allowance for an error message.
   */
  const charge = () => consumeQuota(user.id, "disease_scan", plan);

  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    // Size is checked before the bytes are read into memory. The storage bucket
    // enforces the same 5 MB ceiling (migration 014), but failing here gives the
    // farmer a sentence instead of an opaque storage error — and avoids buffering
    // an arbitrarily large upload just to reject it.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `That image is too large. Please upload a photo under ${MAX_UPLOAD_MB} MB.` },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // The declared type is whatever the client wrote in the multipart body, so
    // it is not evidence of anything — a text file renamed .jpg arrives claiming
    // image/jpeg. Trust the magic bytes instead.
    const sniffed = sniffImageType(bytes);
    if (!sniffed) {
      return NextResponse.json(
        { error: "That file isn't a JPEG, PNG or WebP image. Please upload a photo of the leaf." },
        { status: 415 }
      );
    }

    // Re-encode through sharp: strips EXIF/GPS and every other metadata segment
    // (phone cameras write the field's coordinates into EXIF), applies EXIF
    // orientation, caps the dimensions, and refuses a decompression bomb.
    let clean: Buffer;
    let mime: "image/jpeg" | "image/png";
    try {
      const norm = await normalizeImage(bytes, sniffed);
      clean = norm.bytes;
      mime = norm.mime;
    } catch (e) {
      if (e instanceof ImageRejectedError) {
        return NextResponse.json({ error: e.message }, { status: 415 });
      }
      throw e;
    }
    const dataUrl = `data:${mime};base64,${clean.toString("base64")}`;

    // 1) Try the local trained classifier.
    let modelBest: { crop: string; disease: string; confidence: number; healthy: boolean } | null = null;
    let modelUp = false;
    // null when no classifier is configured and we are not on a dev machine —
    // skip straight to the vision fallback rather than dial a dead address.
    const inferenceUrl = inferenceBaseUrl();
    try {
      if (!inferenceUrl) throw new Error("no inference server configured");
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(clean)], { type: mime }), "leaf.jpg");
      const infRes = await fetch(`${inferenceUrl}/predict`, {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(15000),
      });
      if (infRes.ok) {
        modelUp = true;
        const j = await infRes.json();
        modelBest = j.best;
      }
    } catch {
      modelUp = false; // server not running — fall through to vision
    }

    // 2) High-confidence classifier result → enrich with Groq narrative.
    if (modelBest && modelBest.confidence >= CONFIDENCE_THRESHOLD) {
      const narrative = await narrativeFromLabel(modelBest.crop, modelBest.disease);
      const result: DiseaseResult = {
        source: "model",
        crop: modelBest.crop,
        disease: modelBest.disease,
        healthy: modelBest.healthy,
        confidence: modelBest.confidence,
        severity: (narrative.severity ?? "Medium") as DiseaseResult["severity"],
        affectedAreaPct: Number(narrative.affectedAreaPct ?? 0),
        summary: narrative.summary ?? "",
        treatment: {
          organic: narrative.treatment?.organic ?? [],
          chemical: narrative.treatment?.chemical ?? [],
        },
        recovery: narrative.recovery ?? "",
        prevention: narrative.prevention ?? [],
        note: "Identified by the trained PlantVillage model.",
      };
      await persistScan(result, clean, mime);
      await charge();
      return NextResponse.json(result);
    }

    // 3) Low confidence or model unavailable → Groq vision fallback on the actual image.
    const visionResult = await diagnoseFromImage(dataUrl);
    if (modelUp && modelBest) {
      visionResult.note = `Trained model was unsure (${Math.round(
        modelBest.confidence * 100
      )}%) — diagnosed with AI vision instead.`;
    }
    await persistScan(visionResult, clean, mime);
    await charge();
    return NextResponse.json(visionResult);
  } catch (e: any) {
    console.error("DISEASE route error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Diagnosis failed. Please try again." },
      { status: 500 }
    );
  }
}
