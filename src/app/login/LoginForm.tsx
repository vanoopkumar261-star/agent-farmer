"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Leaf, Check } from "lucide-react";
import AuthPanel from "@/components/auth/AuthPanel";
import { useT } from "@/components/i18n/LanguageProvider";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { t } = useT();

  // All credential handling lives in <AuthPanel/>; this page only decides
  // where to go afterwards.
  const handleAuthed = () => {
    router.push(next);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-af-bg text-af-ink">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Left: visual panel */}
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
                {t("login.badge")}
              </span>
            </div>

            <div className="max-w-md space-y-4">
              <h1 className="font-sans text-4xl font-extrabold tracking-tight text-white leading-[1.05]">
                {t("login.hero.title")}
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                {t("login.hero.sub")}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  t("login.trust.simple"),
                  t("login.trust.private"),
                  t("login.trust.dataOnly"),
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
              {t("login.footer.tag")}
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="relative flex items-center justify-center px-6 py-12">
          <div className="pointer-events-none absolute -top-12 left-10 h-72 w-72 rounded-full bg-af-primary/10 blur-[70px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-af-ai/10 blur-[90px]" />

          <div className="w-full max-w-md relative z-10">
            <div className="mb-5 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-af-ink-2 hover:text-af-primary transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("login.backHome")}
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-[28px] bg-af-card border border-af-border shadow-af-float p-7 sm:p-8">
              <AuthPanel onAuthed={handleAuthed} />

              <div className="mt-6 text-center text-xs text-af-muted">
                {t("login.legal")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
