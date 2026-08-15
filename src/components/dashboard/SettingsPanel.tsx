"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/config";
import Card from "@/components/ui/Card";
import DataPrivacyModal from "@/components/dashboard/DataPrivacyModal";
import {
  User,
  Globe,
  Bell,
  Shield,
  Check,
  Loader2,
  MapPin,
  CloudSun,
  Bug,
  TrendingUp,
  Sparkles,
  LogOut,
} from "lucide-react";

type NotifPrefs = { weather: boolean; disease: boolean; market: boolean; ai: boolean };

type Profile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  house_address: string | null;
  preferences?: Record<string, any> | null;
};

const DEFAULT_NOTIF: NotifPrefs = { weather: true, disease: true, market: false, ai: true };

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { t, locale, setLocale } = useT();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showDataPrivacy, setShowDataPrivacy] = useState(false);

  const [notif, setNotif] = useState<NotifPrefs>({
    ...DEFAULT_NOTIF,
    ...(profile.preferences?.notifications ?? {}),
  });


  // Resolve the login username (internal email is <handle>@agentfarmer.local).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const em = data.user?.email;
      if (em) setUsername(em.replace(/@agentfarmer\.local$/, ""));
    });
  }, []);

  // Persist a notification toggle immediately into farmer_profiles.preferences.
  async function toggleNotif(key: keyof NotifPrefs) {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    try {
      await supabase
        .from("farmer_profiles")
        .update({ preferences: { ...(profile.preferences ?? {}), notifications: next } })
        .eq("id", profile.id);
    } catch {
      /* preferences column may not exist yet — keep the local toggle */
    }
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("farmer_profiles")
      .update({ name, phone, email: email || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      alert("Could not save profile.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile */}
      <Card className="p-6">
        <SectionTitle icon={<User className="w-4 h-4" />} title="Profile" subtitle="Your personal details" />
        <div className="mt-5 space-y-4">
          <Field label="Full Name" value={name} onChange={setName} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone" value={phone} onChange={setPhone} />
            <Field label="Email" value={email} onChange={setEmail} placeholder="name@example.com" />
          </div>
          <div className="flex items-start gap-2 rounded-[12px] bg-af-bg border border-af-border px-4 py-3">
            <MapPin className="w-4 h-4 text-af-primary mt-0.5 shrink-0" />
            <div className="text-meta text-af-ink-2">{profile.house_address ?? "No location set"}</div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-semibold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? t("common.saved") : t("common.save")}
          </button>
        </div>
      </Card>

      {/* Language */}
      <Card className="p-6">
        <SectionTitle icon={<Globe className="w-4 h-4" />} title="Language" subtitle="Choose your preferred language" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`rounded-[12px] border px-3 py-2.5 text-sm font-semibold transition ${
                locale === l.code
                  ? "border-af-primary/50 bg-af-primary/[0.06] text-af-primary-deep ring-2 ring-af-primary/15"
                  : "border-af-border bg-af-card text-af-ink-2 hover:border-af-primary/30"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-af-muted">
          The interface switches instantly. Farm data stays in your language of choice.
        </p>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <SectionTitle icon={<Bell className="w-4 h-4" />} title="Notifications" subtitle="What you'll be alerted about" />
        <div className="mt-5 space-y-1">
          <Toggle icon={<CloudSun className="w-4 h-4 text-af-ai" />} label="Weather alerts" desc="Rain, heat & storm warnings"
            on={notif.weather} onToggle={() => toggleNotif("weather")} />
          <Toggle icon={<Bug className="w-4 h-4 text-af-amber" />} label="Disease alerts" desc="Scan reminders & outbreaks"
            on={notif.disease} onToggle={() => toggleNotif("disease")} />
          <Toggle icon={<TrendingUp className="w-4 h-4 text-af-primary-deep" />} label="Market prices" desc="Selling-window signals"
            on={notif.market} onToggle={() => toggleNotif("market")} />
          <Toggle icon={<Sparkles className="w-4 h-4 text-af-ai" />} label="Daily summary" desc="Farm briefing & tips"
            on={notif.ai} onToggle={() => toggleNotif("ai")} />
        </div>
      </Card>


      {/* Account */}
      <Card className="p-6">
        <SectionTitle icon={<Shield className="w-4 h-4" />} title="Account" subtitle="Your login & session" />
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-[12px] bg-af-bg border border-af-border px-4 py-3">
            <span className="text-sm font-semibold text-af-ink">Signed in as</span>
            <span className="text-meta font-semibold text-af-primary-deep">{username ?? "—"}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center justify-between rounded-[12px] bg-af-bg border border-af-border px-4 py-3">
              <span className="text-sm font-semibold text-af-ink">Phone</span>
              <span className="text-meta font-semibold text-af-ink-2">{profile.phone}</span>
            </div>
          )}
          <button
            onClick={() => setShowDataPrivacy(true)}
            className="w-full flex items-center justify-between rounded-[12px] bg-af-bg border border-af-border px-4 py-3 hover:border-af-primary/30 transition"
          >
            <span className="text-sm font-semibold text-af-ink">Data &amp; privacy</span>
            <span className="text-meta font-semibold text-af-primary-deep">Manage &rarr;</span>
          </button>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 rounded-[12px] bg-af-danger/10 border border-af-danger/20 px-4 py-3 text-sm font-semibold text-af-danger hover:bg-af-danger/15 transition disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </Card>

      {showDataPrivacy && (
        <DataPrivacyModal profile={profile} onClose={() => setShowDataPrivacy(false)} />
      )}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">{icon}</span>
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-af-ink leading-tight">{title}</h2>
        <p className="text-meta text-af-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[14px] bg-af-bg border border-af-border px-4 py-3 text-sm text-af-ink placeholder:text-af-muted outline-none focus:ring-2 focus:ring-af-primary/25 focus:border-af-primary/40 transition"
      />
    </div>
  );
}

function Toggle({ icon, label, desc, on, onToggle }: { icon: React.ReactNode; label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-af-bg transition">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg border border-af-border shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold text-af-ink">{label}</div>
        <div className="text-[11px] text-af-muted">{desc}</div>
      </div>
      <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-af-primary" : "bg-af-border"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

