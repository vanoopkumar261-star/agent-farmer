import "server-only";
import { getDashboardData, cropStage, daysSince } from "./dashboard";
import { getWeather } from "./weather";

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
    const stage = crop ? cropStage(crop.seeding_date) : null;
    const days = crop ? daysSince(crop.seeding_date) : null;
    return `- Farm ${f.farm_index}: ${f.area} acres, ${f.soil_type}, ${f.irrigation} irrigation${
      crop
        ? `, growing ${crop.chosen_crop} (seeded ${crop.seeding_date}, day ${days}, ${stage?.label} stage)`
        : ", no crop selected yet"
    }`;
  });

  const weatherLine = weather
    ? `Current weather: ${weather.current.temp}°C, ${weather.current.label}, humidity ${weather.current.humidity}%, wind ${weather.current.windKph} km/h. Next days rain chance: ${weather.daily
        .slice(0, 4)
        .map((d) => `${d.weekday} ${d.precipProb}%`)
        .join(", ")}.`
    : "Weather data is currently unavailable.";

  return [
    `Farmer: ${farmer.name}${farmer.phone ? ` (phone ${farmer.phone})` : ""}.`,
    `Location: ${farmer.house_address ?? "unknown"}.`,
    `Farms (${farms.length}):`,
    ...farmLines,
    weatherLine,
  ].join("\n");
}
