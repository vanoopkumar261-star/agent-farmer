import InputPriceCard from "@/components/dashboard/InputPriceCard";
import { T } from "@/components/i18n/LanguageProvider";
import PageHeader from "@/components/ui/PageHeader";
import Reveal from "@/components/ui/Reveal";
import { PackageSearch } from "lucide-react";

export const dynamic = "force-dynamic";

export default function InputPricesPage() {
  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHeader
        icon={<PackageSearch className="w-5 h-5" />}
        title={<T k="title.inputs" />}
        subtitle={<T k="inputs.subtitle" />}
      />
      <Reveal>
        <InputPriceCard />
      </Reveal>
    </div>
  );
}
