"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/i18n/LanguageProvider";
import { LOCALES } from "@/lib/i18n/config";
import Card from "@/components/ui/Card";
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
} from "lucide-react";

type Profile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  house_address: string | null;
};

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { t, locale, setLocale } = useT();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notif, setNotif] = useState({ weather: true, disease: true, market: false, ai: true });

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
            <div className="text-[13px] text-af-ink-2">{profile.house_address ?? "No location set"}</div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-3 text-sm font-bold transition active:scale-[0.98] shadow-af-sm disabled:opacity-50"
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
            on={notif.weather} onToggle={() => setNotif((n) => ({ ...n, weather: !n.weather }))} />
          <Toggle icon={<Bug className="w-4 h-4 text-af-amber" />} label="Disease alerts" desc="Scan reminders & outbreaks"
            on={notif.disease} onToggle={() => setNotif((n) => ({ ...n, disease: !n.disease }))} />
          <Toggle icon={<TrendingUp className="w-4 h-4 text-af-primary-deep" />} label="Market prices" desc="Selling-window signals"
            on={notif.market} onToggle={() => setNotif((n) => ({ ...n, market: !n.market }))} />
          <Toggle icon={<Sparkles className="w-4 h-4 text-af-ai" />} label="AI insights" desc="Daily summary & tips"
            on={notif.ai} onToggle={() => setNotif((n) => ({ ...n, ai: !n.ai }))} />
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6">
        <SectionTitle icon={<Shield className="w-4 h-4" />} title="Security" subtitle="Account & data" />
        <div className="mt-5 space-y-3">
          <Row label="Phone verification" value="Verified" tone="good" />
          <Row label="Two-factor auth" value="Set up" tone="action" />
          <Row label="Data & privacy" value="Manage" tone="action" />
          <Row label="Sign out" value="→" tone="action" />
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage text-af-secondary">{icon}</span>
      <div>
        <h2 className="text-lg font-extrabold text-af-ink leading-tight">{title}</h2>
        <p className="text-[13px] text-af-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-af-muted">{label}</label>
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
        <div className="text-sm font-bold text-af-ink">{label}</div>
        <div className="text-[11px] text-af-muted">{desc}</div>
      </div>
      <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-af-primary" : "bg-af-border"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "good" | "action" }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] bg-af-bg border border-af-border px-4 py-3">
      <span className="text-sm font-semibold text-af-ink">{label}</span>
      <span className={`text-[13px] font-bold ${tone === "good" ? "text-af-primary-deep" : "text-af-ai"}`}>{value}</span>
    </div>
  );
}
