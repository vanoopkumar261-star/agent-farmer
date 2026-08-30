import { Droplets, Wind, ThermometerSun, MapPin } from "lucide-react";
import type { WeatherData } from "@/lib/weather";
import { T } from "@/components/i18n/LanguageProvider";

export default function WeatherCard({
  weather,
  place,
}: {
  weather: WeatherData | null;
  place: string;
}) {
  if (!weather) {
    return (
      <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6">
        <div className="text-sm text-af-muted"><T k="weatherCard.unavailable" /></div>
      </div>
    );
  }

  const { current, daily } = weather;

  return (
    <div className="rounded-2xl bg-af-card border border-af-border shadow-af-sm p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-af-muted">
          <T k="weatherCard.liveWeather" />
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-af-muted max-w-[55%] truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          {place}
        </span>
      </div>

      {/* Current */}
      <div className="flex items-center gap-4 mt-3">
        <div className="text-5xl leading-none animate-af-float motion-reduce:animate-none">{current.icon}</div>
        <div>
          <div className="flex items-start">
            <span className="font-mono text-5xl font-semibold text-af-ink leading-none">
              {current.temp}
            </span>
            <span className="text-xl font-semibold text-af-muted mt-1">°C</span>
          </div>
          <div className="text-sm font-semibold text-af-ink-2 mt-1">{current.label}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Stat icon={<ThermometerSun className="w-4 h-4" />} label={<T k="weatherCard.feels" />} value={`${current.apparent}°`} />
        <Stat icon={<Droplets className="w-4 h-4" />} label={<T k="weatherCard.humidity" />} value={`${current.humidity}%`} />
        <Stat icon={<Wind className="w-4 h-4" />} label={<T k="weatherCard.wind" />} value={`${current.windKph} km/h`} />
      </div>

      {/* 7-day */}
      <div className="mt-6 pt-5 border-t border-af-border">
        <div className="grid grid-cols-7 gap-1.5">
          {daily.map((d, i) => (
            <div
              key={d.dateISO}
              className={`flex flex-col items-center gap-1 rounded-xl py-2.5 ${
                i === 0 ? "bg-af-sage" : ""
              }`}
            >
              <span className="text-[10px] font-semibold text-af-muted uppercase">
                {i === 0 ? <T k="weatherCard.today" /> : d.weekday}
              </span>
              <span className="text-lg leading-none">{d.icon}</span>
              <span className="font-mono text-[11px] font-semibold text-af-ink">{d.tMax}°</span>
              <span className="font-mono text-[10px] text-af-muted">{d.tMin}°</span>
              {d.precipProb >= 30 && (
                <span className="font-mono text-[9px] font-semibold text-af-ai">{d.precipProb}%</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-xl bg-af-bg border border-af-border px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-af-muted">{icon}</div>
      <div className="mt-1.5 font-mono text-sm font-semibold text-af-ink">{value}</div>
      <div className="text-[10px] font-semibold text-af-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}
