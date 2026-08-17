import { NextResponse } from "next/server";
import { getCropRecommendations, FarmInput } from "@/lib/gemini";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

export async function POST(req: Request) {
  // Counted before any work is done — the point is to refuse the expensive
  // call, not to do it and then complain.
  const rl = await checkRateLimit(req, "recommendations");
  if (!rl.ok) return rateLimited(rl);

  try {
    const body = await req.json();

    const locationAddress = String(body?.locationAddress ?? "");
    const farms = (body?.farms ?? []) as FarmInput[];
    const preferOilseed = body?.preferOilseed === true;

    if (!locationAddress || !Array.isArray(farms) || farms.length === 0) {
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