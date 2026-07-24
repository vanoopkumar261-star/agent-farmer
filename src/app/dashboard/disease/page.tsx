import DiseaseScanner from "@/components/dashboard/DiseaseScanner";
import { T } from "@/components/i18n/LanguageProvider";
import { Microscope } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DiseasePage() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-af-sage text-af-secondary">
          <Microscope className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-af-ink"><T k="title.disease" /></h1>
          <p className="mt-0.5 text-sm text-af-ink-2">
            Upload a leaf — our trained model identifies the disease, AI writes the treatment plan.
          </p>
        </div>
      </div>
      <DiseaseScanner />
    </div>
  );
}
