import { NextResponse } from "next/server";
import { getCropRecommendations, FarmInput } from "@/lib/gemini";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { clampArr, clampStr, payloadTooLarge, PayloadTooLargeError, readJsonBounded } from "@/lib/apiInput";

export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "recommendations");
  if (!rl.ok) return rateLimited(rl);

  try {
    let body: any;
    try {
      body = await readJsonBounded(req, 16_000);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return payloadTooLarge();
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const locationAddress = clampStr(body?.locationAddress, 200);
    const farms: FarmInput[] = clampArr<any>(body?.farms, 20).map((f) => {
      const ph = Number(f?.soilPh);
      return {
        area: Number(f?.area) || 0,
        soilType: clampStr(f?.soilType, 40),
        irrigation: clampStr(f?.irrigation, 40),
        soilPh: Number.isFinite(ph) && ph >= 0 && ph <= 14 ? ph : undefined,
      };
    });
    const preferOilseed = body?.preferOilseed === true;

    if (!locationAddress || farms.length === 0) {
      return NextResponse.json(
        { error: "Missing locationAddress or farms[]" },
        { status: 400 }
      );
    }

    const result = await getCropRecommendations({ locationAddress, farms, preferOilseed });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}