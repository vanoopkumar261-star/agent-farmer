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
  Layers,
  Waves,
  Mountain,
  Grip,
  CloudRain,
  Droplets,
  SprayCan,
  ArrowDownToLine,
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
import ChoiceCardGrid from "@/components/onboarding/ChoiceCardGrid";
import ReviewStep from "@/components/onboarding/ReviewStep";
import CropGuideModal from "@/components/onboarding/CropGuideModal";
import { TermsModal, PrivacyModal } from "@/components/legal/LegalModals";
import {
  normalizeEmail,
  normalizePhone,
  validateArea,
  validateEmail,
  validatePhone,
  INVALID_EMAIL_MSG,
  INVALID_NUMBER_MSG,
} from "@/lib/validation";
import { LanguageProvider, useT } from "@/components/i18n/LanguageProvider";

type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Maps the fixed set of English messages `validateEmail` can return to a translated string. */
function translateEmailError(raw: string | null, t: Translator): string | null {
  if (!raw) return null;
  if (raw === "Email is required.") return t("login.error.emailRequired");
  if (raw === INVALID_EMAIL_MSG) return t("login.error.invalidEmail");
  return raw;
}

/** Maps the fixed set of English messages `validatePhone` can return to a translated string. */
function translatePhoneError(raw: string | null, t: Translator): string | null {
  if (!raw) return null;
  if (raw === "Phone number is required.") return t("onboarding.error.phoneRequired");
  if (raw === "Phone number must contain digits only.") return t("onboarding.error.phoneDigitsOnly");
  if (raw === "Phone number must be exactly 10 digits.") return t("onboarding.error.phoneLength");
  return raw;
}

/** Maps the fixed set of English messages `validateArea` can return to a translated string, with a translated field label. */
function translateAreaError(raw: string | null, labelKey: string, t: Translator): string | null {
  if (!raw) return null;
  if (raw === INVALID_NUMBER_MSG) return t("onboarding.error.invalidNumber");
  if (raw.endsWith("is required.")) return t("onboarding.error.areaRequired", { label: t(labelKey) });
  if (raw.endsWith("must be greater than 0.")) return t("onboarding.error.areaMustBePositive", { label: t(labelKey) });
  return raw;
}

const SOIL_TYPE_KEYS: Record<string, string> = {
  "Alluvial Soil": "onboarding.soilType.alluvial",
  "Black Soil": "onboarding.soilType.black",
  "Red Soil": "onboarding.soilType.red",
  "Sandy Soil": "onboarding.soilType.sandy",
  "Clayey Soil": "onboarding.soilType.clayey",
};

const IRRIGATION_TYPE_KEYS: Record<string, string> = {
  Borewell: "onboarding.irrigation.borewell",
  Canal: "onboarding.irrigation.canal",
  River: "onboarding.irrigation.river",
  "Rain-fed": "onboarding.irrigation.rainfed",
  "Drip Irrigation": "onboarding.irrigation.drip",
  Sprinkler: "onboarding.irrigation.sprinkler",
};

/**
 * Slug and icon per option. The slug is the photo filename for irrigation and
 * the swatch key for soil; the icon rides on top of both, because a borewell
 * photo and a canal photo are hard to tell apart at thumbnail size.
 */
const SOIL_META: Record<string, { slug: string; Icon: typeof Layers }> = {
  "Alluvial Soil": { slug: "alluvial", Icon: Waves },
  "Black Soil": { slug: "black", Icon: Layers },
  "Red Soil": { slug: "red", Icon: Mountain },
  "Sandy Soil": { slug: "sandy", Icon: Grip },
  "Clayey Soil": { slug: "clayey", Icon: Layers },
};

const IRRIGATION_META: Record<string, { slug: string; Icon: typeof Layers }> = {
  Borewell: { slug: "borewell", Icon: ArrowDownToLine },
  Canal: { slug: "canal", Icon: Waves },
  River: { slug: "river", Icon: Waves },
  "Rain-fed": { slug: "rainfed", Icon: CloudRain },
  "Drip Irrigation": { slug: "drip", Icon: Droplets },
  Sprinkler: { slug: "sprinkler", Icon: SprayCan },
};

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
  { n: 1, labelKey: "onboarding.step.profile" },
  { n: 2, labelKey: "onboarding.step.farms" },
  { n: 3, labelKey: "onboarding.step.crops" },
  { n: 4, labelKey: "onboarding.step.review" },
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
  // Deliberately empty. These used to default to "Alluvial Soil" / "Rain-fed",
  // and the live data showed 35 of 60 farms as Alluvial and 54 of 60 as
  // Rain-fed — a pre-filled dropdown nobody opened. The validation at
  // `canProceedCropSelection` already rejects empty values; it was simply
  // unreachable while the defaults were here.
  return { area: "", soilType: "", irrigation: "" };
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

function OnboardingContent() {
  const router = useRouter();
  const { t } = useT();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

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
  const [saving, setSaving] = useState(false);
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

  const soilOptions = useMemo(
    () => SOIL_TYPES.map((s) => ({ label: t(SOIL_TYPE_KEYS[s]), value: s, ...SOIL_META[s] })),
    [t]
  );
  const irrigationOptions = useMemo(
    () => IRRIGATION_TYPES.map((s) => ({ label: t(IRRIGATION_TYPE_KEYS[s]), value: s, ...IRRIGATION_META[s] })),
    [t]
  );

  /**
   * Validation messages for step 1 and step 2.
   *
   * Computed unconditionally so the Continue buttons can gate on them, and
   * surfaced per field only once that field has been blurred (see `touched`) —
   * otherwise an untouched form greets the farmer covered in red.
   */
  const phoneError = translatePhoneError(validatePhone(form.phone), t);
  const emailError = translateEmailError(validateEmail(form.email), t);
  const totalAreaError = translateAreaError(
    validateArea(form.totalArea, "Total farm area"),
    "onboarding.label.totalFarmArea",
    t
  );
  const farmAreaErrors = form.farms.map((f) =>
    translateAreaError(validateArea(f.area, "Farm area"), "onboarding.label.farmArea", t)
  );

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) => setTouched((p) => ({ ...p, [key]: true }));
  const shown = (key: string, error: string | null) => (touched[key] ? error : null);

  const canGoStep2 = useMemo(() => {
    return Boolean(
      form.name.trim() &&
        !phoneError &&
        !emailError &&
        form.location?.lat &&
        form.location?.lng
    );
  }, [form.name, form.location, phoneError, emailError]);

  const canProceedCropSelection = useMemo(() => {
    if (totalAreaError) return false;
    if (form.numFarms < 1 || form.numFarms > 6) return false;

    for (let i = 0; i < form.farms.length; i++) {
      if (farmAreaErrors[i]) return false;
      if (!form.farms[i].soilType) return false;
      if (!form.farms[i].irrigation) return false;
    }
    return true;
  }, [form.numFarms, form.farms, totalAreaError, farmAreaErrors]);

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
        alert(data?.error ?? t("onboarding.error.aiEngineFailed"));
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
      alert(t("onboarding.error.networkError"));
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

  /**
   * What the review screen reads back. Built here rather than in the component
   * because this is where the canonical values and the label maps already live.
   */
  const reviewFarms = useMemo(
    () =>
      form.farms.map((f, i) => ({
        index: i + 1,
        area: f.area || "—",
        soilLabel: f.soilType ? t(SOIL_TYPE_KEYS[f.soilType]) : "—",
        irrigationLabel: f.irrigation ? t(IRRIGATION_TYPE_KEYS[f.irrigation]) : "—",
        cropName: effectiveCrop(selections[i]) || "—",
        seedingDate: selections[i]?.seedingDate || "—",
      })),
    [form.farms, selections, t]
  );

  /**
   * District and state where the geocoder gave them, so the sentence reads
   * "in Dharwad district, Karnataka" rather than reciting a postal address at
   * someone who is checking it at a glance.
   */
  const reviewPlace = useMemo(() => {
    const loc = form.location;
    if (loc?.district && loc?.state) return `${loc.district}, ${loc.state}`;
    if (loc?.address) {
      return loc.address.split(",").map((x) => x.trim()).filter(Boolean).slice(-3, -1).join(", ");
    }
    return t("onboarding.review.placeUnknown");
  }, [form.location, t]);

  const handleContinueDashboard = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const farmer = await createFarmerProfile({
        name: form.name,
        // Stored as the bare ten digits, so a farmer who typed "+91 98765 43210"
        // and one who typed "9876543210" end up with the same value on file.
        phone: normalizePhone(form.phone),
        // Stored exactly as the farmer typed it, padding aside — an address
        // is not ours to rewrite.
        email: normalizeEmail(form.email),
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
      setSaving(false);
      alert(t("onboarding.error.saveFailed"));
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
                {t("onboarding.badge.onboarding")}
              </span>
            </div>

            <div className="max-w-md space-y-4">
              <h1 className="font-sans text-4xl font-extrabold tracking-tight text-white leading-[1.05]">
                {step === 1
                  ? t("onboarding.hero.title.step1")
                  : step === 2
                  ? t("onboarding.hero.title.step2")
                  : t("onboarding.hero.title.step3")}
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                {step === 1
                  ? t("onboarding.hero.sub.step1")
                  : step === 2
                  ? t("onboarding.hero.sub.step2")
                  : t("onboarding.hero.sub.step3")}
              </p>

              {/* Reassurance chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  t("onboarding.chip.free"),
                  t("onboarding.chip.aiPersonalised"),
                  t("onboarding.chip.time"),
                ].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/85"
                  >
                    <Check className="w-3 h-3" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-white/55 font-mono text-[10px] tracking-[0.22em] uppercase">
              {t("onboarding.footer.tag")}
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
                {t("login.backHome")}
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
                    title={t("onboarding.signedInAs", { email: accountEmail })}
                  >
                    <span className="hidden sm:inline">{accountEmail} · </span>
                    <span className="font-semibold underline underline-offset-2">{t("onboarding.notYou")}</span>
                  </button>
                )}
                <span className="font-mono text-[11px] font-semibold text-af-muted">
                  {t("onboarding.stepOf", { n: step })}
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
                      title={t("onboarding.step1.title")}
                      subtitle={t("onboarding.step1.subtitle")}
                      hint={t("onboarding.step1.hint")}
                    />

                    <div className="mt-7 space-y-5">
                      <Field
                        label={t("onboarding.field.fullName")}
                        placeholder={t("onboarding.field.fullNamePlaceholder")}
                        value={form.name}
                        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field
                          label={t("onboarding.field.phone")}
                          placeholder={t("onboarding.field.phonePlaceholder")}
                          value={form.phone}
                          onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                          onBlur={() => markTouched("phone")}
                          error={shown("phone", phoneError)}
                          inputMode="numeric"
                          // Ten digits plus room for the formatting farmers
                          // actually type: "+91 98765 43210" is already 15
                          // characters, so a tighter cap silently truncates a
                          // valid number into an invalid one.
                          maxLength={18}
                        />
                        <Field
                          label={t("onboarding.field.email")}
                          placeholder={t("onboarding.field.emailPlaceholder")}
                          value={form.email}
                          onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                          onBlur={() => markTouched("email")}
                          error={shown("email", emailError)}
                          inputMode="email"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                          {t("onboarding.field.houseLocation")}
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
                        {t("onboarding.continue")} <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}

                {/* STEP 02 */}
                {step === 2 && (
                  <>
                    <HeaderBlock
                      step="02"
                      title={t("onboarding.step2.title")}
                      subtitle={t("onboarding.step2.subtitle")}
                      hint={t("onboarding.step2.hint")}
                    />

                    <div className="mt-7 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field
                          label={t("onboarding.field.totalArea")}
                          placeholder={t("onboarding.field.totalAreaPlaceholder")}
                          value={form.totalArea}
                          onChange={(v) => setForm((p) => ({ ...p, totalArea: v }))}
                          onBlur={() => markTouched("totalArea")}
                          error={shown("totalArea", totalAreaError)}
                          inputMode="decimal"
                        />

                        <div className="space-y-1.5">
                          <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                            {t("onboarding.field.numFarms")}
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center rounded-[14px] border border-af-border bg-af-bg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setNumFarms(form.numFarms - 1)}
                                disabled={form.numFarms <= 1}
                                className="px-3.5 py-3 text-af-ink-2 hover:bg-af-sage hover:text-af-secondary disabled:opacity-40 transition"
                                aria-label={t("onboarding.decreaseFarms")}
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
                                aria-label={t("onboarding.increaseFarms")}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-[11px] text-af-muted">{t("onboarding.upToSix")}</span>
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
                                <div className="font-sans font-bold text-af-ink">{t("onboarding.farm.n", { n: idx + 1 })}</div>
                              </div>
                              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-af-muted">
                                {t("onboarding.fieldProfile")}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                              <div className="space-y-1.5">
                                <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                  {t("onboarding.field.farmArea")}
                                </label>
                                <input
                                  value={f.area}
                                  onChange={(e) => updateFarm(idx, { area: e.target.value })}
                                  onBlur={() => markTouched(`farmArea-${idx}`)}
                                  placeholder={t("onboarding.field.farmAreaPlaceholder")}
                                  inputMode="decimal"
                                  aria-invalid={Boolean(shown(`farmArea-${idx}`, farmAreaErrors[idx]))}
                                  className={`w-full rounded-[14px] bg-af-card border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 transition ${
                                    shown(`farmArea-${idx}`, farmAreaErrors[idx])
                                      ? "border-af-danger/50 focus:border-af-danger focus:ring-af-danger/20"
                                      : "border-af-border focus:border-af-primary/40 focus:ring-af-primary/25"
                                  }`}
                                />
                                {shown(`farmArea-${idx}`, farmAreaErrors[idx]) && (
                                  <FieldError message={farmAreaErrors[idx]!} />
                                )}
                              </div>

                              <ChoiceCardGrid
                                name={`soil-${idx}`}
                                kind="soil"
                                legend={t("onboarding.field.soilType")}
                                value={f.soilType}
                                onChange={(v) => updateFarm(idx, { soilType: v })}
                                options={soilOptions}
                              />

                              <ChoiceCardGrid
                                name={`irrigation-${idx}`}
                                kind="irrigation"
                                legend={t("onboarding.field.irrigation")}
                                value={f.irrigation}
                                onChange={(v) => updateFarm(idx, { irrigation: v })}
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
                          {t("onboarding.back")}
                        </button>

                        <button
                          disabled={!canProceedCropSelection || loadingAI}
                          onClick={handleFetchAI}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
                        >
                          {loadingAI ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("onboarding.analyzingFarms")}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              {t("onboarding.proceedToCropSelection")}
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
                      title={t("onboarding.step3.title")}
                      subtitle={t("onboarding.step3.subtitle")}
                      hint={t("onboarding.step3.hint")}
                      accent="ai"
                    />

                    <div className="mt-6 flex items-start gap-2 rounded-[16px] bg-af-ai-soft border border-af-ai/15 px-4 py-3">
                      <BadgeCheck className="w-4 h-4 text-af-ai mt-0.5 shrink-0" />
                      <div className="text-sm text-af-ink-2 leading-relaxed">
                        {t("onboarding.step3.instructions")}
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
                                    <div className="font-sans font-bold text-af-ink">{t("onboarding.farm.n", { n: idx + 1 })}</div>
                                    <div className="text-xs text-af-muted">
                                      {(SOIL_TYPE_KEYS[f.soilType] ? t(SOIL_TYPE_KEYS[f.soilType]) : f.soilType)} ·{" "}
                                      {(IRRIGATION_TYPE_KEYS[f.irrigation] ? t(IRRIGATION_TYPE_KEYS[f.irrigation]) : f.irrigation)} · {f.area} {t("onboarding.acresUnit")}
                                    </div>
                                  </div>
                                </div>
                                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-af-muted">
                                  {t("onboarding.threeAiOptions")}
                                </div>
                              </div>

                              {recs.length === 0 ? (
                                <div className="flex items-start gap-2 rounded-[16px] bg-af-danger/8 border border-af-danger/20 px-4 py-3">
                                  <AlertTriangle className="w-4 h-4 text-af-danger mt-0.5 shrink-0" />
                                  <div className="text-sm text-af-ink-2">
                                    {t("onboarding.noAiRecs")}
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
                                    {t("onboarding.field.customCrop")}
                                  </label>
                                  <input
                                    value={sel?.customCrop ?? ""}
                                    onChange={(e) => updateSelection(idx, { customCrop: e.target.value })}
                                    placeholder={t("onboarding.field.customCropPlaceholder")}
                                    className="w-full rounded-[14px] bg-af-card border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
                                  />
                                  <div className="text-[11px] text-af-muted">
                                    {t("onboarding.customCropOverrideNote")}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
                                      {t("onboarding.field.seedingDate")}
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
                                      {t("onboarding.field.harvestDate")}
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
                                        ? t("onboarding.harvestDateTouchedNote")
                                        : t("onboarding.harvestDateSuggestedNote")}
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
                          {t("onboarding.agreeToTerms")}{" "}
                          <button
                            type="button"
                            onClick={() => setShowTerms(true)}
                            className="font-semibold text-af-primary-deep underline underline-offset-2 hover:text-af-primary"
                          >
                            {t("onboarding.termsLink")}
                          </button>{" "}
                          {t("onboarding.andThe")}{" "}
                          <button
                            type="button"
                            onClick={() => setShowPrivacy(true)}
                            className="font-semibold text-af-primary-deep underline underline-offset-2 hover:text-af-primary"
                          >
                            {t("onboarding.privacyLink")}
                          </button>
                          {t("onboarding.consentSuffix")}
                        </div>
                      </label>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => setStep(2)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-card hover:bg-af-bg border border-af-border px-6 py-3.5 text-sm font-bold text-af-ink transition active:scale-[0.98]"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          {t("onboarding.back")}
                        </button>

                        {/* Opens the check screen. Nothing is written until the
                            farmer confirms there. */}
                        <button
                          disabled={!canContinueDashboard}
                          onClick={() => setStep(4)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-6 py-3.5 text-sm font-bold transition active:scale-[0.98] shadow-af-md disabled:opacity-50 disabled:hover:bg-af-primary disabled:cursor-not-allowed"
                        >
                          {t("onboarding.continueToDashboard")} <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {step === 4 && (
                  <ReviewStep
                    name={form.name}
                    place={reviewPlace}
                    farms={reviewFarms}
                    saving={saving}
                    onBack={() => setStep(3)}
                    onConfirm={handleContinueDashboard}
                  />
                )}

                <div className="mt-6 text-center text-xs text-af-muted">
                  {t("onboarding.tipChangeLater")}
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

export default function OnboardingPage() {
  return (
    <LanguageProvider>
      <OnboardingContent />
    </LanguageProvider>
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
  const { t } = useT();
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
                {t("onboarding.badge.getStarted")}
              </span>
            </div>

            <div className="max-w-md space-y-4">
              <h1 className="font-sans text-4xl font-semibold tracking-[-0.03em] text-white leading-[1.05]">
                {t("onboarding.auth.title")}
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                {t("onboarding.auth.sub")}
              </p>
            </div>

            <div className="text-white/55 font-mono text-[10px] tracking-[0.22em] uppercase">
              {t("login.footer.tag")}
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
                {t("login.backHome")}
              </Link>
            </div>

            <div className="rounded-[28px] bg-af-card border border-af-border shadow-af-float p-7 sm:p-8">
              <AuthPanel onAuthed={onAuthed} />
              <p className="mt-6 text-center text-xs text-af-muted">
                {t("login.legal")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const { t } = useT();
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
                {t(s.labelKey)}
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
  const { t } = useT();
  const accentText = accent === "ai" ? "text-af-ai" : "text-af-primary-deep";
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full bg-af-bg border border-af-border px-3.5 py-1.5">
        <span className={`font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${accentText}`}>
          {t("onboarding.stepLabel")} {step}
        </span>
        <span className="text-sm text-af-ink-2">{subtitle}</span>
      </div>

      <h2 className="mt-3 font-sans text-2xl font-extrabold text-af-ink">{title}</h2>
      <p className="text-sm text-af-ink-2">{hint}</p>
    </div>
  );
}

/**
 * A labelled text input that can show a validation message.
 *
 * `error` is only rendered once `onBlur` has fired, so a farmer typing the first
 * character of their phone number isn't immediately told it's too short. The
 * caller owns that "touched" state because it also needs it to decide whether
 * the step can advance.
 */
function Field({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  inputMode,
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  inputMode?: "text" | "numeric" | "decimal" | "email";
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-[14px] bg-af-bg border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 transition ${
          error
            ? "border-af-danger/50 focus:border-af-danger focus:ring-af-danger/20"
            : "border-af-border focus:border-af-primary/40 focus:ring-af-primary/25"
        }`}
      />
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-[12px] font-semibold text-af-danger">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      {message}
    </p>
  );
}
