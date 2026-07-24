import { NextResponse } from "next/server";
import { narrativeFromLabel, diagnoseFromImage, DiseaseResult } from "@/lib/disease";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INFERENCE_URL = process.env.INFERENCE_URL ?? "http://127.0.0.1:8008";
const CONFIDENCE_THRESHOLD = 0.6;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = (file as any).type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

    // 1) Try the local trained classifier.
    let modelBest: { crop: string; disease: string; confidence: number; healthy: boolean } | null = null;
    let modelUp = false;
    try {
      const fd = new FormData();
      fd.append("file", new Blob([bytes], { type: mime }), "leaf.jpg");
      const infRes = await fetch(`${INFERENCE_URL}/predict`, {
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
      return NextResponse.json(result);
    }

    // 3) Low confidence or model unavailable → Groq vision fallback on the actual image.
    const visionResult = await diagnoseFromImage(dataUrl);
    if (modelUp && modelBest) {
      visionResult.note = `Trained model was unsure (${Math.round(
        modelBest.confidence * 100
      )}%) — diagnosed with AI vision instead.`;
    }
    return NextResponse.json(visionResult);
  } catch (e: any) {
    console.error("DISEASE route error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Diagnosis failed. Please try again." },
      { status: 500 }
    );
  }
}
