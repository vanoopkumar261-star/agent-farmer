import { NextResponse } from "next/server";
import { getSessionFarmer } from "@/lib/auth";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { sniffImageType, normalizeImage, ImageRejectedError } from "@/lib/image";
import { readPhFromImage } from "@/lib/soilReading";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Reads a pH value off a photo of a handheld meter's display.
 *
 * Mirrors /api/disease but: requires a session (this is a dashboard write
 * path), has no local-classifier branch, and — crucially — does NOT persist.
 * The value comes back for the farmer to confirm/correct on screen; the client
 * then writes the row directly via the browser Supabase client under RLS. A
 * misread number is dangerous, so a human check sits between the model and the
 * record.
 */
export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "soil-reading");
  if (!rl.ok) return rateLimited(rl);

  const farmer = await getSessionFarmer();
  if (!farmer) {
    return NextResponse.json({ error: "Please sign in to read your pH meter." }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No photo uploaded." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `That photo is too large. Please upload one under ${MAX_UPLOAD_MB} MB.` },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    const sniffed = sniffImageType(bytes);
    if (!sniffed) {
      return NextResponse.json(
        { error: "That file isn't a JPEG, PNG or WebP image. Please upload a photo of the meter." },
        { status: 415 }
      );
    }

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
    const result = await readPhFromImage(dataUrl);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("soil-reading error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Could not read the meter. Please try again." },
      { status: 500 }
    );
  }
}
