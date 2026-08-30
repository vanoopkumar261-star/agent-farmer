import { NextResponse } from "next/server";
import { checkRateLimit, rateLimited } from "@/lib/rateLimit";

/**
 * Live field-sensor readings for the dashboard.
 *
 * ESP32 nodes publish temperature / humidity / soil-moisture to ThingSpeak
 * channels; this route reads them back and hands the dashboard a per-metric
 * series. All configuration is environment-only (see `.env.example` →
 * "Sensor readings") so a channel or read key can be pasted in without a code
 * change:
 *
 *   THINGSPEAK_CHANNEL_A_ID / _READ_KEY
 *   THINGSPEAK_CHANNEL_A_FIELD_TEMPERATURE | _HUMIDITY | _SOIL_MOISTURE  (1..8)
 *   THINGSPEAK_CHANNEL_B_*  — a second node, same shape (optional)
 *
 * A metric is served by the first configured channel that maps a field number
 * for it, so one node can carry all three or two nodes can split them.
 */

export const dynamic = "force-dynamic";

const THINGSPEAK = "https://api.thingspeak.com";

// Enough history for the modal chart; the readings table shows the last 20.
const RESULTS = 100;

export type MetricKey = "temperature" | "humidity" | "soilMoisture";

export type SensorReading = { at: string; value: number };

export type SensorMetric = {
  key: MetricKey;
  /** A channel maps a field number for this metric. */
  configured: boolean;
  unit: string;
  /** Most recent reading, or null if the channel returned nothing usable. */
  latest: SensorReading | null;
  /** Newest first, up to RESULTS entries. */
  readings: SensorReading[];
};

export type SensorSnapshot = {
  /** Any ThingSpeak channel is configured. */
  configured: boolean;
  /** Newest reading time across all metrics, ISO. */
  updatedAt: string | null;
  metrics: SensorMetric[];
};

const METRIC_KEYS: MetricKey[] = ["temperature", "humidity", "soilMoisture"];

const UNITS: Record<MetricKey, string> = {
  temperature: "°C",
  humidity: "%",
  soilMoisture: "%",
};

const ENV_SUFFIX: Record<MetricKey, string> = {
  temperature: "TEMPERATURE",
  humidity: "HUMIDITY",
  soilMoisture: "SOIL_MOISTURE",
};

type ChannelCfg = {
  id: string;
  readKey?: string;
  fields: Partial<Record<MetricKey, number>>;
};

/** Reads THINGSPEAK_CHANNEL_<tag>_* into a channel config, or null if unset. */
function readChannel(tag: "A" | "B"): ChannelCfg | null {
  const id = process.env[`THINGSPEAK_CHANNEL_${tag}_ID`]?.trim();
  if (!id) return null;

  const fieldNum = (m: MetricKey): number | undefined => {
    const raw = process.env[`THINGSPEAK_CHANNEL_${tag}_FIELD_${ENV_SUFFIX[m]}`]?.trim();
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 8 ? n : undefined;
  };

  return {
    id,
    readKey: process.env[`THINGSPEAK_CHANNEL_${tag}_READ_KEY`]?.trim() || undefined,
    fields: {
      temperature: fieldNum("temperature"),
      humidity: fieldNum("humidity"),
      soilMoisture: fieldNum("soilMoisture"),
    },
  };
}

type Feed = Record<string, string | null> & { created_at: string };

async function fetchFeeds(cfg: ChannelCfg): Promise<Feed[]> {
  const params = new URLSearchParams({ results: String(RESULTS) });
  if (cfg.readKey) params.set("api_key", cfg.readKey);
  const url = `${THINGSPEAK}/channels/${encodeURIComponent(cfg.id)}/feeds.json?${params}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`ThingSpeak channel ${cfg.id}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.feeds) ? (data.feeds as Feed[]) : [];
  } catch (e) {
    console.warn(`ThingSpeak channel ${cfg.id} fetch failed:`, e);
    return [];
  }
}

/** Pulls one field out of the feed list as a clean, newest-first number series. */
function seriesFromFeeds(feeds: Feed[], fieldNum: number): SensorReading[] {
  const key = `field${fieldNum}`;
  const out: SensorReading[] = [];
  for (const f of feeds) {
    const raw = f[key];
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ at: f.created_at, value: Math.round(value * 10) / 10 });
  }
  // ThingSpeak returns oldest-first; the UI wants newest-first.
  out.reverse();
  return out;
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "sensors");
  if (!rl.ok) return rateLimited(rl);

  const channels = [readChannel("A"), readChannel("B")].filter(
    (c): c is ChannelCfg => c !== null
  );

  const empty = (configured: boolean): SensorSnapshot => ({
    configured,
    updatedAt: null,
    metrics: METRIC_KEYS.map((key) => ({
      key,
      configured: false,
      unit: UNITS[key],
      latest: null,
      readings: [],
    })),
  });

  if (channels.length === 0) {
    return NextResponse.json(empty(false));
  }

  // One fetch per configured channel, shared across whichever metrics map to it.
  const feedsByChannel = new Map<ChannelCfg, Feed[]>();
  await Promise.all(
    channels.map(async (c) => {
      feedsByChannel.set(c, await fetchFeeds(c));
    })
  );

  const metrics: SensorMetric[] = METRIC_KEYS.map((key) => {
    const owner = channels.find((c) => c.fields[key] != null);
    if (!owner) {
      return { key, configured: false, unit: UNITS[key], latest: null, readings: [] };
    }
    const readings = seriesFromFeeds(feedsByChannel.get(owner) ?? [], owner.fields[key]!);
    return {
      key,
      configured: true,
      unit: UNITS[key],
      latest: readings[0] ?? null,
      readings,
    };
  });

  const updatedAt =
    metrics
      .map((m) => m.latest?.at)
      .filter((a): a is string => Boolean(a))
      .sort()
      .pop() ?? null;

  return NextResponse.json({
    configured: metrics.some((m) => m.configured),
    updatedAt,
    metrics,
  } satisfies SensorSnapshot);
}
