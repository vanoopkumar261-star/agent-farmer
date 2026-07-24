import { NextResponse } from "next/server";
import { getCropRecommendations, FarmInput } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const locationAddress = String(body?.locationAddress ?? "");
    const farms = (body?.farms ?? []) as FarmInput[];

    if (!locationAddress || !Array.isArray(farms) || farms.length === 0) {
      return NextResponse.json(
        { error: "Missing locationAddress or farms[]" },
        { status: 400 }
      );
    }

    const result = await getCropRecommendations({ locationAddress, farms });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}