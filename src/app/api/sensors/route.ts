import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";
import { readSensorSnapshot } from "@/lib/sensors";

/**
 * Live field-sensor readings for the dashboard's sensor panel.
 *
 * A thin wrapper now: the reading logic lives in `src/lib/sensors.ts` so the
 * dashboard's health score can call it directly during its server render
 * instead of making an HTTP round-trip to this route.
 */

export const dynamic = "force-dynamic";

export type {
  MetricKey,
  SensorReading,
  SensorMetric,
  SensorSnapshot,
} from "@/lib/sensors";

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "sensors");
  if (!rl.ok) return rateLimited(rl);

  return NextResponse.json(await readSensorSnapshot());
}
