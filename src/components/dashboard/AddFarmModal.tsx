"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sprout,
  Sparkles,
  X,
} from "lucide-react";
import TerraSelect from "@/components/TerraSelect";
import CropRecCard, { CropRec } from "@/components/onboarding/CropRecCard";
import CropGuideModal from "@/components/onboarding/CropGuideModal";
import { createFarms, createCropCycles } from "@/lib/db";
import { suggestHarvestDate } from "@/lib/agronomy";
import { supabase } from "@/lib/supabase";
import { validateArea } from "@/lib/validation";
import { useT } from "@/components/i18n/LanguageProvider";

const SOIL_TYPES = ["Alluvial Soil", "Black Soil", "Red Soil", "Sandy Soil", "Clayey Soil"];
const IRRIGATION_TYPES = ["Borewell", "Canal", "River", "Rain-fed", "Drip Irrigation", "Sprinkler"];

type Profile = { id: string; house_address: string | null; preferences: Record<string, unknown> | null };

/**
 * Adds one farm from inside the dashboard.
 *
 * "New Farm" used to push the farmer back to /onboarding, which is the wrong
 * screen for someone who already has an account: it re-asks for their name,
 * phone and house pin, and its own step counter implies they are starting over.
 * This collects the two things a new field actually needs — the field profile
 * and a crop cycle — and nothing else.
 *
 * It deliberately mirrors onboarding steps 2 and 3 for a single farm, reusing
 * the same recommendation endpoint and the same CropRecCard, so the popup and
 * the wizard cannot drift into recommending different crops for the same soil.
 *
 * The farmer's profile (and with it the house location the recommendation
 * engine needs) is fetched here rather than passed in, so the same component
 * works from the sidebar and from the dashboard body without either caller
 * having to thread server data down to it.
 */
export default function AddFarmModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { t } = useT();

  const [stage, setStage] = useState<"field" | "crop">("field");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [area, setArea] = useState("");
  const [areaTouched, setAreaTouched] = useState(false);
  const [soilType, setSoilType] = useState(SOIL_TYPES[0]);
  const [irrigation, setIrrigation] = useState("Rain-fed");

  const [recs, setRecs] = useState<CropRec[] | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const [chosenCrop, setChosenCrop] = useState("");
  const [customCrop, setCustomCrop] = useState("");
  const [seedingDate, setSeedingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [harvestDate, setHarvestDate] = useState("");
  const [harvestTouched, setHarvestTouched] = useState(false);
  const [guideCrop, setGuideCrop] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * The modal is portalled to <body>.
   *
   * One of its two triggers lives in the sidebar, which is `position: sticky` —
   * and a sticky element creates a stacking context, so a `fixed inset-0 z-[70]`
   * child rendered inside it is trapped in that context and paints *underneath*
   * the main column. Escaping to the body is the only reliable fix; raising
   * z-index does nothing across stacking contexts.
   *
   * `mounted` gates the portal because document.body does not exist during the
   * server render.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const areaError = areaTouched ? validateArea(area, "Farm area") : null;
  const effectiveCrop = (customCrop.trim() || chosenCrop).trim();

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setProfileError(t("addFarmModal.signedOut"));
        return;
      }
      const { data, error } = await supabase
        .from("farmer_profiles")
        .select("id, house_address, preferences")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!alive) return;
      if (error || !data) {
        setProfileError(t("addFarmModal.loadProfileError"));
        return;
      }
      setProfile(data as Profile);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // Re-suggest the harvest date whenever the crop or seeding date moves, unless
  // the farmer has set one themselves — their date always wins.
  useEffect(() => {
    if (harvestTouched) return;
    if (!effectiveCrop || !seedingDate) return;
    setHarvestDate(suggestHarvestDate(effectiveCrop, seedingDate));
  }, [effectiveCrop, seedingDate, harvestTouched]);

  const canFetchAI = useMemo(
    () => !validateArea(area, "Farm area") && Boolean(soilType && irrigation && profile),
    [area, soilType, irrigation, profile]
  );

  const fetchRecommendations = async () => {
    if (!canFetchAI || !profile) return;
    setLoadingAI(true);
    setAiNote(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationAddress: profile.house_address || "India",
          farms: [{ area: Number(area), soilType, irrigation }],
          preferOilseed: profile.preferences?.["oilseed_ack"] === true,
        }),
      });
      const data = (await res.json()) as { farms?: CropRec[][]; error?: string };

      if (!res.ok || !data.farms?.[0]?.length) {
        // Not fatal — the farmer can still type a crop by hand, so the stage
        // advances either way rather than trapping them behind a failed call.
        setRecs([]);
        setAiNote(data?.error ?? t("addFarmModal.aiUnavailable"));
      } else {
        setRecs(data.farms[0]);
        setChosenCrop(data.farms[0][0].cropName);
      }
      setStage("crop");
    } catch {
      setRecs([]);
      setAiNote(t("addFarmModal.networkError"));
      setStage("crop");
    } finally {
      setLoadingAI(false);
    }
  };

  const canApply =
    Boolean(profile) &&
    !validateArea(area, "Farm area") &&
    Boolean(effectiveCrop) &&
    Boolean(seedingDate) &&
    (!harvestDate || harvestDate > seedingDate) &&
    !saving;

  const handleApply = async () => {
    if (!canApply || !profile) return;
    setSaving(true);
    setSaveError(null);

    try {
      // createFarms continues the farmer's existing farm numbering, so the new
      // field becomes "Farm 4" rather than a second "Farm 1".
      const inserted = await createFarms(profile.id, [{ area: Number(area), soilType, irrigation }]);
      await createCropCycles(inserted, [
        {
          chosenCrop,
          customCrop,
          seedingDate,
          estimatedHarvestDate: harvestDate,
        },
      ]);

      // Every dashboard route is force-dynamic, so refreshing the server tree is
      // all it takes for the new farm to appear in the tiles, Your Farms, My
      // Farms and the activity log.
      router.refresh();
      onClose();
    } catch (e) {
      console.error(e);
      setSaveError(t("addFarmModal.saveError"));
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("addFarmModal.title")}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-af-ink/50" onClick={() => !saving && onClose()} />

      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-af-border bg-af-card shadow-af-float">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-af-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-af-sage text-af-secondary">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-sans text-lg font-semibold text-af-ink">{t("addFarmModal.title")}</h2>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-af-muted">
                {stage === "field" ? t("addFarmModal.step1") : t("addFarmModal.step2")}
              </p>
            </div>
          </div>
          <button
            onClick={() => !saving && onClose()}
            aria-label={t("addFarmModal.close")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-af-border bg-af-bg text-af-muted transition hover:border-af-primary/40 hover:text-af-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {profileError ? (
            <div className="flex items-start gap-2 rounded-[16px] border border-af-danger/20 bg-af-danger/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-af-danger" />
              <div className="text-sm text-af-ink-2">{profileError}</div>
            </div>
          ) : !profile ? (
            <div className="flex items-center gap-2 py-6 text-sm text-af-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("addFarmModal.loadingProfile")}
            </div>
          ) : stage === "field" ? (
            <div className="space-y-5">
              <p className="text-sm text-af-ink-2">
                {t("addFarmModal.fieldIntro")}
              </p>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
                  {t("addFarmModal.farmArea")}
                </label>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  onBlur={() => setAreaTouched(true)}
                  inputMode="decimal"
                  placeholder={t("addFarmModal.areaPlaceholder")}
                  aria-invalid={Boolean(areaError)}
                  className={`w-full rounded-[14px] border bg-af-bg px-4 py-3 text-sm text-af-ink outline-none transition placeholder:text-af-muted focus:ring-2 ${
                    areaError
                      ? "border-af-danger/50 focus:border-af-danger focus:ring-af-danger/20"
                      : "border-af-border focus:border-af-primary/40 focus:ring-af-primary/25"
                  }`}
                />
                {areaError && <FieldError message={areaError} />}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TerraSelect
                  label={t("addFarmModal.soilType")}
                  value={soilType}
                  onValueChange={setSoilType}
                  options={SOIL_TYPES.map((s) => ({ label: s, value: s }))}
                />
                <TerraSelect
                  label={t("addFarmModal.irrigation")}
                  value={irrigation}
                  onValueChange={setIrrigation}
                  options={IRRIGATION_TYPES.map((s) => ({ label: s, value: s }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[16px] border border-af-border bg-af-bg px-4 py-3 text-xs text-af-ink-2">
                {t("addFarmModal.summaryLine", { soil: soilType, irrigation, area })}
              </div>

              {aiNote && (
                <div className="flex items-start gap-2 rounded-[16px] border border-af-amber/20 bg-af-amber/10 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-af-amber-ink" />
                  <div className="text-sm text-af-ink-2">
                    {aiNote} {t("addFarmModal.aiNoteSuffix")}
                  </div>
                </div>
              )}

              {recs && recs.length > 0 && (
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recs.map((r, i) => (
                    <CropRecCard
                      key={i}
                      rec={r}
                      selected={(customCrop.trim() ? "" : chosenCrop) === r.cropName}
                      onSelect={() => {
                        setChosenCrop(r.cropName);
                        setCustomCrop("");
                      }}
                      onViewGuide={() => setGuideCrop(r.cropName)}
                    />
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
                  {t("addFarmModal.customCrop")}
                </label>
                <input
                  value={customCrop}
                  onChange={(e) => setCustomCrop(e.target.value)}
                  placeholder={t("addFarmModal.customCropPlaceholder")}
                  className="w-full rounded-[14px] border border-af-border bg-af-bg px-4 py-3 text-sm text-af-ink outline-none transition placeholder:text-af-muted focus:border-af-primary/40 focus:ring-2 focus:ring-af-primary/25"
                />
                <div className="text-[11px] text-af-muted">
                  {t("addFarmModal.customCropHint")}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
                    {t("addFarmModal.seedingDate")}
                  </label>
                  <input
                    type="date"
                    value={seedingDate}
                    onChange={(e) => setSeedingDate(e.target.value)}
                    className="w-full rounded-[14px] border border-af-border bg-af-bg px-4 py-3 text-sm text-af-ink outline-none transition focus:border-af-primary/40 focus:ring-2 focus:ring-af-primary/25"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-af-muted">
                    {t("addFarmModal.estHarvestDate")}
                  </label>
                  <input
                    type="date"
                    min={seedingDate || undefined}
                    value={harvestDate}
                    onChange={(e) => {
                      setHarvestTouched(true);
                      setHarvestDate(e.target.value);
                    }}
                    className="w-full rounded-[14px] border border-af-border bg-af-bg px-4 py-3 text-sm text-af-ink outline-none transition focus:border-af-primary/40 focus:ring-2 focus:ring-af-primary/25"
                  />
                  <div className="text-[11px] text-af-muted">
                    {harvestTouched
                      ? t("addFarmModal.harvestHintCustom")
                      : t("addFarmModal.harvestHintSuggested")}
                  </div>
                </div>
              </div>

              {saveError && <FieldError message={saveError} />}
            </div>
          )}
        </div>

        {/* Footer */}
        {profile && !profileError && (
          <div className="flex shrink-0 flex-col gap-3 border-t border-af-border px-6 py-5 sm:flex-row">
            {stage === "crop" && (
              <button
                onClick={() => setStage("field")}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-af-border bg-af-card px-6 py-3 text-sm font-bold text-af-ink transition hover:bg-af-bg active:scale-[0.98] disabled:opacity-50 sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("addFarmModal.back")}
              </button>
            )}

            {stage === "field" ? (
              <button
                onClick={fetchRecommendations}
                disabled={!canFetchAI || loadingAI}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-af-primary px-6 py-3 text-sm font-bold text-white shadow-af-md transition hover:bg-af-primary-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-af-primary"
              >
                {loadingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("addFarmModal.analysing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("addFarmModal.chooseCrop")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-af-primary px-6 py-3 text-sm font-bold text-white shadow-af-md transition hover:bg-af-primary-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-af-primary"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("addFarmModal.addingFarm")}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t("addFarmModal.apply")}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {guideCrop && (
        <CropGuideModal
          crop={guideCrop}
          soil={soilType}
          irrigation={irrigation}
          region={profile?.house_address ?? undefined}
          onClose={() => setGuideCrop(null)}
        />
      )}
    </div>,
    document.body
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-[12px] font-semibold text-af-danger">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}
