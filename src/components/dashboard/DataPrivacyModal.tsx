"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Bug,
  Check,
  Database,
  Eye,
  FileText,
  Lock,
  MapPin,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";

/**
 * "Data & Privacy" — what Agent Farmer stores about this farmer, links to the
 * legal documents, and a data-deletion request.
 *
 * From Manan's fork (a9a11e9). One caveat carried over honestly: his deletion
 * button only flips local state — it contacts nobody and removes nothing. Left
 * as he wrote it, but it needs a real backend before a farmer should trust it.
 */

import { useState } from "react";
import { TermsModal, PrivacyModal } from "@/components/legal/LegalModals";
import { useT } from "@/components/i18n/LanguageProvider";

type Profile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  house_address: string | null;
  preferences?: Record<string, any> | null;
};

// ── Data & Privacy Modal ──────────────────────────────────────────────────────
export default function DataPrivacyModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const { t } = useT();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      {/* Nested modals */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-[28px] bg-af-card border border-af-border shadow-af-float overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-af-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-sage">
                <ShieldCheck className="w-5 h-5 text-af-secondary" />
              </div>
              <div>
                <h2 className="font-sans text-lg font-semibold text-af-ink">{t("dataPrivacyModal.title")}</h2>
                <p className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
                  {t("dataPrivacyModal.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-bg border border-af-border text-af-muted hover:text-af-ink hover:border-af-primary/40 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-7 py-6 space-y-5">

            {/* Your data summary */}
            <div className="space-y-2">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
                {t("dataPrivacyModal.yourData")}
              </div>

              <div className="rounded-[16px] bg-af-bg border border-af-border overflow-hidden">
                <DataRow
                  icon={<User className="w-4 h-4 text-af-primary" />}
                  label={t("dataPrivacyModal.profileInfoLabel")}
                  value={profile.name}
                  desc={t("dataPrivacyModal.profileInfoDesc")}
                />
                <DataRow
                  icon={<MapPin className="w-4 h-4 text-af-primary" />}
                  label={t("dataPrivacyModal.farmDataLabel")}
                  value={t("dataPrivacyModal.farmDataValue")}
                  desc={t("dataPrivacyModal.farmDataDesc")}
                />
                <DataRow
                  icon={<Sparkles className="w-4 h-4 text-af-ai" />}
                  label={t("dataPrivacyModal.aiHistoryLabel")}
                  value={t("dataPrivacyModal.aiHistoryValue")}
                  desc={t("dataPrivacyModal.aiHistoryDesc")}
                />
                <DataRow
                  icon={<TrendingUp className="w-4 h-4 text-af-primary-deep" />}
                  label={t("dataPrivacyModal.marketDataLabel")}
                  value={t("dataPrivacyModal.marketDataValue")}
                  desc={t("dataPrivacyModal.marketDataDesc")}
                />
                <DataRow
                  icon={<Bug className="w-4 h-4 text-af-amber" />}
                  label={t("dataPrivacyModal.diseaseDataLabel")}
                  value={t("dataPrivacyModal.diseaseDataValue")}
                  desc={t("dataPrivacyModal.diseaseDataDesc")}
                  last
                />
              </div>
            </div>

            {/* Data protection info */}
            <div className="rounded-[16px] bg-af-primary/5 border border-af-primary/15 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-af-primary shrink-0" />
                <span className="text-sm font-semibold text-af-ink">{t("dataPrivacyModal.protectTitle")}</span>
              </div>
              <ul className="text-[12px] text-af-ink-2 space-y-1.5 pl-6">
                <li className="flex items-start gap-2">
                  <Server className="w-3 h-3 text-af-primary shrink-0 mt-0.5" />
                  {t("dataPrivacyModal.protect1")}
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-3 h-3 text-af-primary shrink-0 mt-0.5" />
                  {t("dataPrivacyModal.protect2")}
                </li>
                <li className="flex items-start gap-2">
                  <Database className="w-3 h-3 text-af-primary shrink-0 mt-0.5" />
                  {t("dataPrivacyModal.protect3")}
                </li>
                <li className="flex items-start gap-2">
                  <Eye className="w-3 h-3 text-af-primary shrink-0 mt-0.5" />
                  {t("dataPrivacyModal.protect4")}
                </li>
              </ul>
            </div>

            {/* Policy documents */}
            <div className="space-y-2">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
                {t("dataPrivacyModal.legalDocs")}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setShowTerms(true)}
                  className="w-full flex items-center gap-3 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 hover:border-af-primary/40 transition text-left"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-card border border-af-border shrink-0">
                    <FileText className="w-4 h-4 text-af-ai" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-af-ink">{t("dataPrivacyModal.terms")}</div>
                    <div className="text-[11px] text-af-muted">{t("dataPrivacyModal.termsMeta")}</div>
                  </div>
                  <span className="text-[12px] font-semibold text-af-primary">{t("dataPrivacyModal.view")}</span>
                </button>

                <button
                  onClick={() => setShowPrivacy(true)}
                  className="w-full flex items-center gap-3 rounded-[14px] bg-af-bg border border-af-border px-4 py-3 hover:border-af-primary/40 transition text-left"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-card border border-af-border shrink-0">
                    <ShieldCheck className="w-4 h-4 text-af-ai" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-af-ink">{t("dataPrivacyModal.privacy")}</div>
                    <div className="text-[11px] text-af-muted">{t("dataPrivacyModal.privacyMeta")}</div>
                  </div>
                  <span className="text-[12px] font-semibold text-af-primary">{t("dataPrivacyModal.view")}</span>
                </button>
              </div>
            </div>

            {/* Data deletion */}
            <div className="space-y-2">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-af-muted">
                {t("dataPrivacyModal.dataManagement")}
              </div>

              {!deletionRequested ? (
                <>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center gap-3 rounded-[14px] bg-af-danger/5 border border-af-danger/20 px-4 py-3 hover:border-af-danger/40 transition text-left"
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-af-danger/10 shrink-0">
                        <Trash2 className="w-4 h-4 text-af-danger" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-af-danger">{t("dataPrivacyModal.requestDeletion")}</div>
                        <div className="text-[11px] text-af-muted">
                          {t("dataPrivacyModal.requestDeletionDesc")}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-[16px] bg-af-danger/5 border border-af-danger/20 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-af-danger shrink-0 mt-0.5" />
                        <div className="text-[13px] text-af-ink leading-relaxed">
                          <strong className="text-af-danger">{t("dataPrivacyModal.confirmQuestion")}</strong>{" "}
                          {t("dataPrivacyModal.confirmBody")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-card border border-af-border px-4 py-2.5 text-sm font-semibold text-af-ink transition active:scale-[0.98]"
                        >
                          {t("dashboard.cancel")}
                        </button>
                        <button
                          onClick={() => {
                            setDeletionRequested(true);
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] bg-af-danger hover:bg-af-danger/90 text-white px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("dataPrivacyModal.confirmDeletion")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2.5 rounded-[14px] bg-af-primary/5 border border-af-primary/15 px-4 py-3">
                  <BadgeCheck className="w-4 h-4 text-af-primary shrink-0 mt-0.5" />
                  <div className="text-[13px] text-af-ink-2">
                    <strong className="text-af-ink">{t("dataPrivacyModal.deletionSubmitted")}</strong>{" "}
                    {t("dataPrivacyModal.deletionBody")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-7 py-4 border-t border-af-border bg-af-bg/50">
            <span className="text-[11px] text-af-muted">© 2026 Agent Farmer</span>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-[14px] bg-af-primary hover:bg-af-primary-deep text-white px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] shadow-af-md"
            >
              <Check className="w-4 h-4" />
              {t("dashboard.done")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DataRow({
  icon,
  label,
  value,
  desc,
  last,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  desc: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        last ? "" : "border-b border-af-border"
      }`}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-af-card border border-af-border shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-af-ink">{label}</div>
        <div className="text-[11px] text-af-muted">{desc}</div>
      </div>
      <span className="text-[12px] font-semibold text-af-primary-deep shrink-0">{value}</span>
    </div>
  );
}

