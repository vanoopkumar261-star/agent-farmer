import { History } from "lucide-react";
import Card from "@/components/ui/Card";
import { T } from "@/components/i18n/LanguageProvider";
import { getDashboardData } from "@/lib/dashboard";
import { getRecentSoilReadings } from "@/lib/history";
import { phBand } from "@/lib/soilPh";
import SoilPhScanner from "@/components/dashboard/SoilPhScanner";
import SoilCropFit from "@/components/dashboard/SoilCropFit";
import SoilPhFix from "@/components/dashboard/SoilPhFix";

export const dynamic = "force-dynamic";

export default async function SoilPage() {
  const { farmer, farms } = await getDashboardData();
  const readings = farmer ? await getRecentSoilReadings(farmer.id, 20) : [];
  const fallowFarms = farms.filter((f) => !f.crop);

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6">
        <h1 className="text-heading font-semibold text-af-ink">
          <T k="title.soilPh" />
        </h1>
        <p className="mt-1 text-sm text-af-ink-2">
          <T k="soilPh.subtitle" />
        </p>
      </div>

      {farmer ? (
        <SoilPhScanner
          farmerId={farmer.id}
          farms={farms.map((f) => ({
            id: f.id,
            farm_index: f.farm_index,
            soil_type: f.soil_type,
            crop: f.crop
              ? {
                  chosen_crop: f.crop.chosen_crop,
                  seeding_date: f.crop.seeding_date,
                  estimated_harvest_date: f.crop.estimated_harvest_date,
                }
              : null,
          }))}
        />
      ) : (
        <Card className="p-8 text-center text-sm text-af-ink-2">
          <T k="dashboard.home.noFarmSubtitle" />
        </Card>
      )}

      {readings.length > 0 && (
        <>
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-af-primary" />
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink">
                <T k="soilPh.history" />
              </h2>
              <span className="font-mono text-[11px] font-semibold text-af-muted">{readings.length}</span>
            </div>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-af-border text-left font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-af-muted">
                    <th className="px-4 py-3"><T k="soilPh.col.date" /></th>
                    <th className="px-4 py-3"><T k="soilPh.col.ph" /></th>
                    <th className="px-4 py-3"><T k="soilPh.col.band" /></th>
                    <th className="px-4 py-3"><T k="soilPh.col.source" /></th>
                    <th className="px-4 py-3"><T k="soilPh.col.note" /></th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => {
                    const band = phBand(r.ph);
                    return (
                      <tr key={r.id} className="border-b border-af-border/60 last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap text-af-ink-2">
                          {new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: band.color }}>
                          {r.ph.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: band.color }}>
                          <T k={`soilPh.band.${band.key}.label`} />
                        </td>
                        <td className="px-4 py-3 text-af-muted">
                          <T k={`soilPh.source.${r.source}`} />
                        </td>
                        <td className="px-4 py-3 text-af-ink-2 max-w-[24ch] truncate">{r.note ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* What to do about the pH, for the crop that is actually growing.
              The farm objects already carry their cycle — this page used to map
              it away before handing them down. */}
          {farmer && farms.length > 0 && (
            <SoilPhFix
              ph={readings[0].ph}
              farms={farms.map((f) => ({
                farm_index: f.farm_index,
                soil_type: f.soil_type,
                crop: f.crop
                  ? {
                      chosen_crop: f.crop.chosen_crop,
                      seeding_date: f.crop.seeding_date,
                      estimated_harvest_date: f.crop.estimated_harvest_date,
                    }
                  : null,
              }))}
            />
          )}

          {/* "Which crops suit this pH" is the wrong question for a standing
              crop and the right one for bare ground, so it survives only for
              farms with no cycle. */}
          {farmer && fallowFarms.length > 0 && (
            <SoilCropFit
              address={farmer.house_address ?? ""}
              preferOilseed={farmer.preferences?.["oilseed_ack"] === true}
              latestPh={readings[0].ph}
              farms={fallowFarms.map((f) => ({
                area: f.area,
                soilType: f.soil_type,
                irrigation: f.irrigation,
                farm_index: f.farm_index,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
