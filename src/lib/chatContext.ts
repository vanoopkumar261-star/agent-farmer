import "server-only";
import { getDashboardData, cropStage, daysSince } from "./dashboard";
import { harvestInfo } from "./agronomy";
import { getWeather } from "./weather";
import { getRecentDiagnoses, getLatestSoilReading } from "./history";
import { phBand } from "./soilPh";
import { npkContextLineEn } from "./npk";

/**
 * Builds the "memory" the AI assistant is given on every turn — farmer profile,
 * farms, crop cycles, and live weather. This is what makes replies contextual.
 */
export async function buildAssistantContext(): Promise<string> {
  const { farmer, farms } = await getDashboardData();

  if (!farmer) {
    return "The farmer has not completed onboarding yet, so no farm data is available. Encourage them to register their farm.";
  }

  const weather =
    farmer.house_lat != null && farmer.house_lng != null
      ? await getWeather(farmer.house_lat, farmer.house_lng)
      : null;

  const farmLines = farms.map((f) => {
    const crop = f.crop;
    const stage = crop
      ? cropStage(crop.seeding_date, crop.chosen_crop, crop.estimated_harvest_date)
      : null;
    const days = crop ? daysSince(crop.seeding_date) : null;
    const harvest = crop
      ? (() => {
          const h = harvestInfo(crop.chosen_crop, crop.seeding_date, crop.estimated_harvest_date);
          const kind = h.estimated ? "estimated harvest" : "planned harvest";
          return `, ${kind} ${h.harvestDate.toISOString().slice(0, 10)} (~${h.daysLeft} days away)`;
        })()
      : "";
    return `- Farm ${f.farm_index}: ${f.area} acres, ${f.soil_type}, ${f.irrigation} irrigation${
      crop
        ? `, growing ${crop.chosen_crop} (seeded ${crop.seeding_date}, day ${days}, ${stage?.label} stage)${harvest}`
        : ", no crop selected yet"
    }`;
  });

  const weatherLine = weather
    ? `Current weather: ${weather.current.temp}°C, ${weather.current.label}, humidity ${weather.current.humidity}%, wind ${weather.current.windKph} km/h. Next days rain chance: ${weather.daily
        .slice(0, 4)
        .map((d) => `${d.weekday} ${d.precipProb}%`)
        .join(", ")}.`
    : "Weather data is currently unavailable.";

  // Latest manual soil-pH reading, so "what should I plant / add" answers can
  // account for acidity.
  const soil = await getLatestSoilReading(farmer.id);
  const soilLine = soil
    ? `Latest soil pH: ${soil.ph} (measured ${new Date(soil.created_at).toLocaleDateString(
        "en-IN"
      )}) — ${phBand(soil.ph).labelEn}. ${phBand(soil.ph).adviceEn}`
    : "";

  // Memory: recent disease scans, so the assistant can reference past diagnoses.
  const diagnoses = await getRecentDiagnoses(farmer.id, 5);
  const diagnosisLines = diagnoses.length
    ? [
        "Recent disease scans:",
        ...diagnoses.map((d) => {
          const when = new Date(d.created_at).toLocaleDateString("en-IN");
          const verdict = d.healthy ? "healthy" : d.disease ?? "issue found";
          const conf = d.confidence != null ? ` (${Math.round(d.confidence * 100)}%)` : "";
          return `- ${when}: ${d.crop_name ?? "crop"} — ${verdict}${conf}`;
        }),
      ]
    : [];

  return [
    `Farmer: ${farmer.name}${farmer.phone ? ` (phone ${farmer.phone})` : ""}.`,
    `Location: ${farmer.house_address ?? "unknown"}.`,
    `Farms (${farms.length}):`,
    ...farmLines,
    weatherLine,
    ...(soilLine ? [soilLine] : []),
    // Nutrients. Unlike every other line here this one is not a measurement,
    // and it says so in its own text — the system prompt forbids inventing farm
    // data, so the provenance has to travel with the numbers.
    npkContextLineEn(),
    ...diagnosisLines,
  ].join("\n");
}
