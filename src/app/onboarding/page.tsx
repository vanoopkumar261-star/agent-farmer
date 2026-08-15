"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Leaf,
  Loader2,
  BadgeCheck,
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SelectedLocation } from "@/components/MapSelector";
const MapSelector = dynamic(() => import("@/components/MapSelector"), { ssr: false });
import TerraSelect from "@/components/TerraSelect";
import { createFarmerProfile, createFarms, createCropCycles } from "@/lib/db";
import { suggestHarvestDate } from "@/lib/agronomy";
import { OILSEED_ACK_KEY, loadOilseedAck } from "@/lib/oilseed";
import { supabase } from "@/lib/supabase";
import { getLiveUser } from "@/lib/session";
import AuthPanel from "@/components/auth/AuthPanel";
import CropRecCard from "@/components/onboarding/CropRecCard";
import CropGuideModal from "@/components/onboarding/CropGuideModal";
import { TermsModal, PrivacyModal } from "@/components/legal/LegalModals";

type Farm = {
  area: string;
  soilType: string;
  irrigation: string;
};

type FarmerForm = {
  name: string;
  phone: string;
  email: string;
  location?: SelectedLocation;

  totalArea: string;
  numFarms: number;
  farms: Farm[];
};

type CropRec = {
  cropName: string;
  suitabilityScore: number;
  confidenceScore: number;
  riskScore: "Low" | "Medium" | "High";
  pros: string[];
  cons: string[];
  estimatedYield: string;
  estimatedProfit: string;
};

const SOIL_TYPES = ["Alluvial Soil", "Black Soil", "Red Soil", "Sandy Soil", "Clayey Soil"];
const IRRIGATION_TYPES = ["Borewell", "Canal", "River", "Rain-fed", "Drip Irrigation", "Sprinkler"];

const STEPS = [
  { n: 1, label: "Profile" },
  { n: 2, label: "Farms" },
  { n: 3, label: "Crops" },
] as const;

type Selection = {
  chosenCrop: string;
  customCrop: string;
  seedingDate: string;
  estimatedHarvestDate: string;
  /** Set once the farmer edits the harvest date themselves — stops auto-suggestion overwriting it. */
  harvestTouched: boolean;
};

function makeFarm(): Farm {
  return { area: "", soilType: "Alluvial Soil", irrigation: "Rain-fed" };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeSelection(): Selection {
  return {
    chosenCrop: "",
    customCrop: "",
    seedingDate: todayISO(),
    estimatedHarvestDate: "",
    harvestTouched: false,
  };
}

/** The crop a selection resolves to — a typed custom crop always wins. */
function effectiveCrop(sel: Selection): string {
  return (sel.customCrop.trim() || sel.chosenCrop).trim();
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [form, setForm] = useState<FarmerForm>({
    name: "",
    phone: "",
    email: "",
    location: undefined,

    totalArea: "",
    numFarms: 1,
    farms: [makeFarm()],
  });

  const [loadingAI, setLoadingAI] = useState(false);
  const [aiRecs, setAiRecs] = useState<CropRec[][] | null>(null);

  const [selections, setSelections] = useState<Selection[]>([makeSelection()]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  // A tick-box agreeing to documents the farmer cannot read is not consent,
  // so both are now openable right where they are being agreed to.
  /** The crop whose guide is open, with the field it is being written for. */
  const [guideCrop, setGuideCrop] = useState<
    { crop: string; soil?: string; irrigation?: string } | null
  >(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // The farmer's oilseed answer — from this session if they just came via the
  // awareness page, otherwise from their saved profile (null = never answered).
  const [oilseedAck, setOilseedAck] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    loadOilseedAck().then((ack) => {
      if (active) setOilseedAck(ack);
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Auth is step 0 of onboarding.
   *
   * `undefined` means we haven't checked yet — important, because rendering the
   * register card during that gap makes it flash for farmers who are already
   * signed in. Middleware no longer redirects this route, so the gate lives here.
   */
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  /** Which account the wizard is about to save under — shown so it's never a surprise. */
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    // getLiveUser, not getUser — an access token stays valid until it expires,
    // so a token whose account has since been deleted would otherwise slip past
    // this gate and only fail much later, on the owner_id foreign key.
    getLiveUser().then((user) => {
      setAuthed(!!user);
      setAccountEmail(user?.email ?? null);
      // Accounts are real email addresses now, so this always prefills.
      if (user?.email) {
        setForm((p) => (p.email ? p : { ...p, email: user.email! }));
      }
    });
  }, []);

  /** Drops the session and returns to step 0 so another farmer can sign in. */
  const signOutToAuth = async () => {
    await supabase.auth.signOut().catch(() => {});
    setAccountEmail(null);
    setForm((p) => ({ ...p, email: "" }));
    setAuthed(false);
    setStep(1);
  };

  /**
   * Where a farmer goes straight after authenticating.
   *
   * Someone signing back in days later already has a profile and wants their
   * dashboard, not the setup wizard. A brand-new account has no profile and
   * continues into step 1. Note this runs only after an auth *action* — an
   * already-signed-in farmer arriving via "+ Add farm" is never redirected away.
   */
  const handleAuthed = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("farmer_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (profile) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setAccountEmail(user.email ?? null);
    if (user.email) setForm((p) => (p.email ? p : { ...p, email: user.email! }));
    setAuthed(true);
  };

  const soilOptions = useMemo(() => SOIL_TYPES.map((s) => ({ label: s, value: s })), []);
  const irrigationOptions = useMemo(
    () => IRRIGATION_TYPES.map((s) => ({ label: s, value: s })),
    []
  );

  const canGoStep2 = useMemo(() => {
    return Boolean(form.name.trim() && form.phone.trim() && form.location?.lat && form.location?.lng);
  }, [form]);

  const canProceedCropSelection = useMemo(() => {
    if (!form.totalArea.trim()) return false;
    if (form.numFarms < 1 || form.numFarms > 6) return false;

    for (const f of form.farms) {
      const areaNum = Number(f.area);
      if (!f.area.trim() || Number.isNaN(areaNum) || areaNum <= 0) return false;
      if (!f.soilType) return false;
      if (!f.irrigation) return false;
    }
    return true;
  }, [form]);

  const setNumFarms = (n: number) => {
    const next = Math.max(1, Math.min(6, n));
    setForm((prev) => {
      const farms = [...prev.farms];
      while (farms.length < next) farms.push(makeFarm());
      while (farms.length > next) farms.pop();

      return { ...prev, numFarms: next, farms };
    });

    setSelections((prev) => {
      const copy = [...prev];
      while (copy.length < next) copy.push(makeSelection());
      while (copy.length > next) copy.pop();
      return copy;
    });
  };

  const updateFarm = (idx: number, patch: Partial<Farm>) => {
    setForm((prev) => {
      const farms = prev.farms.map((f, i) => (i === idx ? { ...f, ...patch } : f));
      return { ...prev, farms };
    });
  };

  /**
   * Patches one farm's crop selection. Whenever the crop or seeding date moves,
   * the harvest date is re-suggested from the agronomy engine — unless the
   * farmer has already set it themselves, in which case their value stands.
   */
  const updateSelection = (idx: number, patch: Partial<Selection>) => {
    setSelections((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const next = { ...s, ...patch };

        const editedHarvest = patch.estimatedHarvestDate !== undefined;
        if (editedHarvest) next.harvestTouched = true;

        const cropOrDateMoved =
          patch.chosenCrop !== undefined ||
          patch.customCrop !== undefined ||
          patch.seedingDate !== undefined;

        if (cropOrDateMoved && !next.harvestTouched) {
          next.estimatedHarvestDate = suggestHarvestDate(effectiveCrop(next), next.seedingDate);
        }
        return next;
      })
    );
  };

  const locationAddress = useMemo(() => {
    const loc = form.location;
    if (!loc) return "";
    return loc.address ?? `Lat ${loc.lat.toFixed(4)}, Lng ${loc.lng.toFixed(4)}`;
  }, [form.location]);

  const handleFetchAI = async () => {
    if (!canProceedCropSelection || !form.location) return;

    setLoadingAI(true);
    setTermsAccepted(false);

    try {
      const payload = {
        locationAddress,
        farms: form.farms.map((f) => ({
          area: Number(f.area),
          soilType: f.soilType,
          irrigation: f.irrigation,
        })),
        // Acknowledging the awareness page asks the engine to surface a
        // suitable oilseed among the options; "No thanks" changes nothing.
        preferOilseed: oilseedAck === true,
      };

      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { farms: CropRec[][]; error?: string };

      if (!res.ok) {
        alert(data?.error ?? "AI engine failed. Please try again.");
        setLoadingAI(false);
        return;
      }

      setAiRecs(data.farms);

      // auto-select first recommendation for each farm, and seed its harvest
      // date from that crop's cycle length (farmer edits still win).
      setSelections((prev) =>
        prev.map((s, idx) => {
          const chosenCrop = data.farms?.[idx]?.[0]?.cropName ?? s.chosenCrop;
          const seedingDate = s.seedingDate || todayISO();
          return {
            ...s,
            chosenCrop,
            customCrop: "",
            seedingDate,
            estimatedHarvestDate: s.harvestTouched
              ? s.estimatedHarvestDate
              : suggestHarvestDate(chosenCrop, seedingDate),
          };
        })
      );

      setStep(3);
    } catch (e) {
      alert("Network error while calling AI engine.");
    } finally {
      setLoadingAI(false);
    }
  };

  const canContinueDashboard = useMemo(() => {
    if (!aiRecs) return false;
    if (!termsAccepted) return false;

    // each farm must have either chosenCrop or customCrop
    for (let i = 0; i < form.numFarms; i++) {
      const sel = selections[i];
      if (!sel) return false;
      const finalCrop = effectiveCrop(sel);
      if (!finalCrop) return false;
      if (!sel.seedingDate) return false;
      // Harvest date must be after seeding when the farmer has set one.
      if (sel.estimatedHarvestDate && sel.estimatedHarvestDate <= sel.seedingDate) return false;
    }
    return true;
  }, [aiRecs, termsAccepted, selections, form.numFarms]);

  const handleContinueDashboard = async () => {
    try {
      const farmer = await createFarmerProfile({
        name: form.name,
        phone: form.phone,
        email: form.email,
        location: form.location,
        locationAddress,
        oilseedAck,
      });

      const farmsInserted = await createFarms(farmer.id, form.farms);

      await createCropCycles(farmsInserted, selections);

      // The answer is persisted on the profile now — don't re-apply it to a
      // later onboarding run from the same tab.
      try {
        sessionStorage.removeItem(OILSEED_ACK_KEY);
      } catch {
        /* storage unavailable — nothing to clear */
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to save data to database.");
    }
  };

  // Step 0 — nobody registers a farm before they have an account to hang it on.
  if (authed === undefined) {
    return (
      <div className="min-h-screen bg-af-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-af-muted" />
      </div>
    );
  }
  if (!authed) return <AuthStep onAuthed={handleAuthed} />;

  return (
    <div className="min-h-screen bg-af-bg text-af-ink">
      {guideCrop && (
        <CropGuideModal
          crop={guideCrop.crop}
          soil={guideCrop.soil}
          irrigation={guideCrop.irrigation}
          region={form.location?.address}
          onClose={() => setGuideCrop(null)}
        />
      )}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Left: Visual panel */}
        <div
          className="relative hidden lg:block"
          style={{
            backgroundImage: "url(/images/onboarding.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65" />

          <div className="relative z-10 p-10 h-full flex flex-col justify-between">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 backdrop-blur border border-white/25 px-4 py-2">
              <Leaf className="w-4 h-4 text-white" />
              <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase text-white/90">
                Agent Farmer · Onboarding
              </span>
            </div>

            <div className="max-w-md space-y-4">
              <h1 className="font-sans text-4xl font-extrabold tracking-tight text-white leading-[1.05]">
                {step === 1
                  ? "Create your Farmer Profile."
                  : step === 2
                  ? "Register your Farms."
                  : "AI Crop Selection."}
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                {step === 1
                  ? "Pin your house on the map — it powers hyper-local weather intelligence and the nearest-store locator."
                  : step === 2
                  ? "Add up to 6 farms. Each field gets its own AI crop recommendations based on soil and irrigation."
                  : "Review 3 AI recommendations per farm, choose crops, set seeding dates, and launch your dashboard."}
              </p>

              {/* Reassurance chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {["Free to start", "AI-personalised", "Takes ~2 min"].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/85"
                  >
                    <Check className="w-3 h-3" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-white/55 font-mono text-[10px] tracking-[0.22em] uppercase">
              0-cost stack · fast setup · production-grade demo
            </div>
          </div>
        </div>

        {/* Right: Steps */}
        <div className="relative flex items-center justify-center px-6 py-12">
          {/* Ambient orbs behind the form card */}
          <div className="pointer-events-none absolute -top-12 left-10 h-72 w-72 rounded-full bg-af-primary/10 blur-[70px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-af-ai/10 blur-[90px]" />

          <div className="w-full max-w-2xl relative z-10">
            <div className="mb-5 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-af-ink-2 hover:text-af-primary transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
              <div className="flex items-center gap-3">
                {/* Without this a signed-in farmer has no way back to the
                    register/sign-in step — they just land on the wizard with
                    someone else's email prefilled and no visible escape. */}
                {accountEmail && (
                  <button
                    type="button"
                    onClick={signOutToAuth}
                    className="text-[11px] text-af-muted hover:text-af-ink transition"
                    title={`Signed in as ${accountEmail}`}
                  >
                    <span className="hidden sm:inline">{accountEmail} · </span>
                    <span className="font-semibold underline underline-offset-2">Not you?</span>
                  </button>
                )}
                <span className="font-mono text-[11px] font-semibold text-af-muted">
                  Step {step} of 3
                </span>
              </div>
            </div>

            {/* Progress stepper */}
            <Stepper current={step} />

            {/* Main Card */}
            <div className="relative mt-6 overflow-hidden rounded-[28px] bg-af-card border border-af-border shadow-af-float p-7 sm:p-8">
              <div className="relative z-10">
                {/* STEP 01 */}
                {step === 1 && (
                  <>
                    <HeaderBlock
                      step="01"
                      title="Farmer Registration"
                      subtitle="Personal Details"
                      hint="Tell us who you are and where your farm is."
                    />

                    <div className="mt-7 space-y-5">
                      <Field
                        label="Full Name"
                        placeholder="Your name"
                        value={form.name}
                        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field
                          label="Phone Number"
                          placeholder="+91 XXXXX XXXXX"
                          value={form.phone}
                          onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                        />
                        <Field
                          label="Email (optional)"
                          placeholder="name@example.com"
                          value={form.email}
                          onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                          House Location (Map)
                        </div>
                        <MapSelector
                          value={form.location}
                          onChange={(loc) => setForm((p) => ({ ...p, location: loc }))}
                        />
                      </div>

                      <button
                        disabled={!canGoStep2}
                        onClick={() => setStep(2)}
                        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
                      >
                        Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 02 */}
                {step === 2 && (
                  <>
                    <HeaderBlock
                      step="02"
                      title="Register Your Farms"
                      subtitle="Farm Details"
                      hint="Each field is analysed separately for the best crop fit."
                    />

                    <div className="mt-7 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field
                          label="Total Farm Area (Acres)"
                          placeholder="e.g. 12"
                          value={form.totalArea}
                          onChange={(v) => setForm((p) => ({ ...p, totalArea: v }))}
                        />

                        <div className="space-y-1.5">
                          <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                            Number of Farms
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center rounded-[14px] border border-af-border bg-af-bg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setNumFarms(form.numFarms - 1)}
                                disabled={form.numFarms <= 1}
                                className="px-3.5 py-3 text-af-ink-2 hover:bg-af-sage hover:text-af-secondary disabled:opacity-40 transition"
                                aria-label="Decrease farms"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <div className="w-12 text-center font-mono text-base font-bold text-af-ink">
                                {form.numFarms}
                              </div>
                              <button
                                type="button"
                                onClick={() => setNumFarms(form.numFarms + 1)}
                                disabled={form.numFarms >= 6}
                                className="px-3.5 py-3 text-af-ink-2 hover:bg-af-sage hover:text-af-secondary disabled:opacity-40 transition"
                                aria-label="Increase farms"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-[11px] text-af-muted">Up to 6 farms</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[420px] overflow-auto pr-1 -mr-1">
                        {form.farms.map((f, idx) => (
                          <div
                            key={idx}
                            className="relative overflow-hidden rounded-[20px] bg-af-bg border border-af-border p-5"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2.5">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-af-sage text-af-secondary text-xs font-bold">
                                  {idx + 1}
                                </span>
                                <div className="font-sans font-bold text-af-ink">Farm {idx + 1}</div>
                              </div>
                              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-af-muted">
                                Field Profile
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                  Farm Area (Acres)
                                </label>
                                <input
                                  value={f.area}
                                  onChange={(e) => updateFarm(idx, { area: e.target.value })}
                                  placeholder="e.g. 3.5"
                                  className="w-full rounded-[14px] bg-af-card border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
                                />
                              </div>

                              <TerraSelect
                                label="Soil Type"
                                value={f.soilType}
                                onValueChange={(v) => updateFarm(idx, { soilType: v })}
                                options={soilOptions}
                              />

                              <TerraSelect
                                label="Irrigation"
                                value={f.irrigation}
                                onValueChange={(v) => updateFarm(idx, { irrigation: v })}
                                options={irrigationOptions}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={() => setStep(1)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-card hover:bg-af-bg border border-af-border px-6 py-3.5 text-sm font-bold text-af-ink transition active:scale-[0.98]"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>

                        <button
                          disabled={!canProceedCropSelection || loadingAI}
                          onClick={handleFetchAI}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
                        >
                          {loadingAI ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Analyzing farms...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Proceed to Crop Selection
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 03 */}
                {step === 3 && (
                  <>
                    <HeaderBlock
                      step="03"
                      title="Crop Recommendations"
                      subtitle="AI Crop Selection"
                      hint="AI generated 3 options per farm — pick one or type your own."
                      accent="ai"
                    />

                    <div className="mt-6 flex items-start gap-2 rounded-[16px] bg-af-ai-soft border border-af-ai/15 px-4 py-3">
                      <BadgeCheck className="w-4 h-4 text-af-ai mt-0.5 shrink-0" />
                      <div className="text-sm text-af-ink-2 leading-relaxed">
                        Choose a crop for each farm, then set a seeding date. You can override with a custom crop anytime.
                      </div>
                    </div>

                    <div className="mt-6 space-y-5 max-h-[520px] overflow-auto pr-1 -mr-1">
                      {form.farms.map((f, idx) => {
                        const recs = aiRecs?.[idx] ?? [];
                        const sel = selections[idx];

                        return (
                          <div
                            key={idx}
                            className="relative overflow-hidden rounded-[20px] bg-af-bg border border-af-border p-5"
                          >
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-af-sage text-af-secondary text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="font-sans font-bold text-af-ink">Farm {idx + 1}</div>
                                    <div className="text-xs text-af-muted">
                                      {f.soilType} · {f.irrigation} · {f.area} acres
                                    </div>
                                  </div>
                                </div>
                                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-af-muted">
                                  3 AI Options
                                </div>
                              </div>

                              {recs.length === 0 ? (
                                <div className="flex items-start gap-2 rounded-[16px] bg-af-danger/8 border border-af-danger/20 px-4 py-3">
                                  <AlertTriangle className="w-4 h-4 text-af-danger mt-0.5 shrink-0" />
                                  <div className="text-sm text-af-ink-2">
                                    AI recommendations not available for this farm. You can enter a custom crop below.
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {recs.map((r, rIdx) => (
                                    <CropRecCard
                                      key={rIdx}
                                      rec={r}
                                      selected={
                                        (sel.customCrop.trim() ? "" : sel.chosenCrop) === r.cropName
                                      }
                                      onSelect={() =>
                                        updateSelection(idx, { chosenCrop: r.cropName, customCrop: "" })
                                      }
                                      onViewGuide={() =>
                                        setGuideCrop({
                                          crop: r.cropName,
                                          soil: form.farms[idx]?.soilType,
                                          irrigation: form.farms[idx]?.irrigation,
                                        })
                                      }
                                    />
                                  ))}
                                </div>
                              )}

                              <div className="space-y-4 pt-1">
                                <div className="space-y-1.5">
                                  <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                    Custom Crop (optional)
                                  </label>
                                  <input
                                    value={sel?.customCrop ?? ""}
                                    onChange={(e) => updateSelection(idx, { customCrop: e.target.value })}
                                    placeholder="Type your own crop..."
                                    className="w-full rounded-[14px] bg-af-card border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
                                  />
                                  <div className="text-[11px] text-af-muted">
                                    If you type here, it overrides the AI selection.
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                      Seeding Date
                                    </label>
                                    <input
                                      type="date"
                                      value={sel?.seedingDate ?? todayISO()}
                                      onChange={(e) => updateSelection(idx, { seedingDate: e.target.value })}
                                      className="w-full rounded-[14px] bg-af-card border border-af-border px-4 py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                      Estimated Harvest Date
                                    </label>
                                    <input
                                      type="date"
                                      min={sel?.seedingDate || undefined}
                                      value={sel?.estimatedHarvestDate ?? ""}
                                      onChange={(e) =>
                                        updateSelection(idx, { estimatedHarvestDate: e.target.value })
                                      }
                                      className="w-full rounded-[14px] bg-af-card border border-af-border px-4 py-3 text-sm text-af-ink outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
                                    />
                                    <div className="text-[11px] text-af-muted">
                                      {sel?.harvestTouched
                                        ? "Your date — used for harvest countdowns."
                                        : "Suggested from the crop cycle. Edit if you plan differently."}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 space-y-3">
                      <label className="flex items-start gap-3 rounded-[16px] bg-af-bg border border-af-border px-4 py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-1 h-4 w-4 accent-af-primary"
                        />
                        <div className="text-sm text-af-ink-2">
                          I agree to the{" "}
                          <button
                            type="button"
                            onClick={() => setShowTerms(true)}
                            className="font-semibold text-af-primary-deep underline underline-offset-2 hover:text-af-primary"
                          >
                            Terms &amp; Conditions
                          </button>{" "}
                          and the{" "}
                          <button
                            type="button"
                            onClick={() => setShowPrivacy(true)}
                            className="font-semibold text-af-primary-deep underline underline-offset-2 hover:text-af-primary"
                          >
                            Privacy Policy
                          </button>
                          , and consent to AI-assisted recommendations, alerts, and decision support.
                        </div>
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => setStep(2)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-card hover:bg-af-bg border border-af-border px-6 py-3.5 text-sm font-bold text-af-ink transition active:scale-[0.98]"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>

                        <button
                          disabled={!canContinueDashboard}
                          onClick={handleContinueDashboard}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
                        >
                          Continue to Dashboard <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-6 text-center text-xs text-af-muted">
                  Tip: You can always change crops later from the dashboard.
                </div>
              </div>
            </div>
            {/* end main card */}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 0 of onboarding — register or sign in.
 *
 * Deliberately wears the same split layout as the wizard behind it, so creating
 * an account reads as the first step of getting set up rather than a separate
 * login product the farmer was bounced to.
 */
function AuthStep({ onAuthed }: { onAuthed: () => void | Promise<void> }) {
  return (
    <div className="min-h-screen bg-af-bg text-af-ink">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        <div
          className="relative hidden lg:block"
          style={{
            backgroundImage: "url(/images/onboarding.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65" />
          <div className="relative z-10 p-10 h-full flex flex-col justify-between">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 backdrop-blur border border-white/25 px-4 py-2">
              <Leaf className="w-4 h-4 text-white" />
              <span className="font-mono text-[10px] font-semibold tracking-[0.22em] uppercase text-white/90">
                Agent Farmer · Get started
              </span>
            </div>

            <div className="max-w-md space-y-4">
              <h1 className="font-sans text-4xl font-semibold tracking-[-0.03em] text-white leading-[1.05]">
                Your farm, your account.
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                Create an account and set up your farms once. Everything after
                that — crops, weather, expenses, disease scans — stays waiting
                for you whenever you come back.
              </p>
            </div>

            <div className="text-white/55 font-mono text-[10px] tracking-[0.22em] uppercase">
              private by design · one account per farmer
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center px-6 py-12">
          <div className="pointer-events-none absolute -top-12 left-10 h-72 w-72 rounded-full bg-af-primary/10 blur-[70px]" />

          <div className="w-full max-w-md relative z-10">
            <div className="mb-5">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-af-ink-2 hover:text-af-primary transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </div>

            <div className="rounded-[28px] bg-af-card border border-af-border shadow-af-float p-7 sm:p-8">
              <AuthPanel onAuthed={onAuthed} />
              <p className="mt-6 text-center text-xs text-af-muted">
                By continuing you agree to our Terms &amp; Conditions and consent
                to AI-assisted decision support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex items-center gap-2.5">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                  ${
                    done
                      ? "bg-af-primary text-white"
                      : active
                      ? "bg-af-primary text-white ring-4 ring-af-primary/20"
                      : "bg-af-card text-af-muted border border-af-border"
                  }`}
              >
                {done ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <div
                className={`hidden sm:block font-mono text-[11px] font-bold uppercase tracking-[0.16em] ${
                  active || done ? "text-af-ink" : "text-af-muted"
                }`}
              >
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-3 h-0.5 rounded-full bg-af-border overflow-hidden">
                <div
                  className={`h-full bg-af-primary transition-all duration-500 ${done ? "w-full" : "w-0"}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HeaderBlock({
  step,
  title,
  subtitle,
  hint,
  accent = "ai",
}: {
  step: string;
  title: string;
  subtitle: string;
  hint: string;
  accent?: "ai" | "primary";
}) {
  const accentText = accent === "ai" ? "text-af-ai" : "text-af-primary-deep";
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full bg-af-bg border border-af-border px-3.5 py-1.5">
        <span className={`font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${accentText}`}>
          Step {step}
        </span>
        <span className="text-sm text-af-ink-2">{subtitle}</span>
      </div>

      <h2 className="mt-3 font-sans text-2xl font-extrabold text-af-ink">{title}</h2>
      <p className="text-sm text-af-ink-2">{hint}</p>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
      />
    </div>
  );
}
