/**
 * Live weather via Open-Meteo — free, no API key required.
 * https://open-meteo.com/
 */

export type DayForecast = {
  dateISO: string;
  weekday: string;
  code: number;
  icon: string;
  label: string;
  tMax: number;
  tMin: number;
  precipProb: number;
};

export type WeatherData = {
  current: {
    temp: number;
    apparent: number;
    humidity: number;
    windKph: number;
    code: number;
    icon: string;
    label: string;
    isDay: boolean;
  };
  daily: DayForecast[];
};

/** WMO weather-code → human label + emoji glyph. */
function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear sky", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code <= 48) return { label: "Foggy", icon: "🌫️" };
  if (code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code <= 77) return { label: "Snow", icon: "🌨️" };
  if (code <= 82) return { label: "Rain showers", icon: "🌧️" };
  if (code <= 86) return { label: "Snow showers", icon: "🌨️" };
  if (code <= 99) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "—", icon: "🌡️" };
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = await res.json();

    const cur = j.current;
    const curDesc = describe(cur.weather_code);

    const daily: DayForecast[] = (j.daily?.time ?? []).map((t: string, i: number) => {
      const desc = describe(j.daily.weather_code[i]);
      return {
        dateISO: t,
        weekday: new Date(t).toLocaleDateString("en-US", { weekday: "short" }),
        code: j.daily.weather_code[i],
        icon: desc.icon,
        label: desc.label,
        tMax: Math.round(j.daily.temperature_2m_max[i]),
        tMin: Math.round(j.daily.temperature_2m_min[i]),
        precipProb: j.daily.precipitation_probability_max?.[i] ?? 0,
      };
    });

    return {
      current: {
        temp: Math.round(cur.temperature_2m),
        apparent: Math.round(cur.apparent_temperature),
        humidity: Math.round(cur.relative_humidity_2m),
        windKph: Math.round(cur.wind_speed_10m),
        code: cur.weather_code,
        icon: curDesc.icon,
        label: curDesc.label,
        isDay: cur.is_day === 1,
      },
      daily,
    };
  } catch (e) {
    console.error("WEATHER error:", e);
    return null;
  }
}
