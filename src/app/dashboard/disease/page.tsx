import DiseaseScanner from "@/components/dashboard/DiseaseScanner";
import { T } from "@/components/i18n/LanguageProvider";
import { getDashboardData } from "@/lib/dashboard";
import { getRecentDiagnoses, signLeafImage, type DiagnosisRecord } from "@/lib/history";
import { ShieldCheck, AlertTriangle, History, Sprout } from "lucide-react";
import Card from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function DiseasePage() {
  const { farmer } = await getDashboardData();
  const scans = farmer ? await getRecentDiagnoses(farmer.id, 8) : [];

  // The bucket is private (migration 014), so a stored path is not a viewable
  // link. Sign them here, on the server, where the service role can — the
  // browser never receives anything that outlives the hour.
  const signed = await Promise.all(
    scans.map(async (s) => ({ ...s, viewUrl: await signLeafImage(s.image_url) }))
  );

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6">
        <h1 className="text-heading font-semibold text-af-ink"><T k="title.disease" /></h1>
        <p className="mt-1 text-sm text-af-ink-2">
          <T k="disease.subtitle" />
        </p>
      </div>

      <DiseaseScanner />

      {scans.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-af-primary" />
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink"><T k="disease.recentScans" /></h2>
            <span className="font-mono text-[11px] font-semibold text-af-muted">{scans.length}</span>
          </div>
          <div className="space-y-3">
            {signed.map((s) => (
              <ScanRow key={s.id} s={s} viewUrl={s.viewUrl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScanRow({ s, viewUrl }: { s: DiagnosisRecord; viewUrl: string | null }) {
  const when = new Date(s.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const conf = s.confidence != null ? Math.round(s.confidence * 100) : null;

  return (
    <Card className="flex items-center gap-4 p-4">
      {viewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewUrl} alt="Leaf photograph from this scan" className="w-14 h-14 rounded-full object-cover border border-af-border shrink-0" />
      ) : (
        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-af-sage text-af-secondary shrink-0">
          <Sprout className="w-6 h-6" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-af-ink truncate">
          {s.healthy ? <T k="disease.healthy" /> : s.disease ?? <T k="disease.issueFound" />}
        </div>
        <div className="mt-0.5 text-meta text-af-ink-2">
          {s.crop_name ?? <T k="disease.crop" />}
          {conf != null && <span className="text-af-muted"> · {conf}%</span>}
        </div>
        <div className="mt-0.5 text-[12px] text-af-muted">{when}</div>
        {s.summary && (
          <p className="mt-1.5 text-meta text-af-ink-2 leading-relaxed line-clamp-2">{s.summary}</p>
        )}
      </div>

      <span className="shrink-0 self-start" title={s.healthy ? "No disease found" : "Needs attention"}>
        {s.healthy ? (
          <ShieldCheck className="w-5 h-5 text-af-primary" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-af-amber" />
        )}
      </span>
    </Card>
  );
}
