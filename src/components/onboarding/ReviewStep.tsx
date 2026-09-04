"use client";

import { MapPin, Check, ArrowLeft, Loader2, Volume2, Square } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

/**
 * The last screen before anything is written to the database.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Onboarding went straight from a terms checkbox into three database writes.
 * Nothing ever repeated the farmer's answers back to them, so a mis-tapped soil
 * card or a pin left on the wrong village was only discoverable later, from the
 * dashboard, in a form they would then have to work out how to correct — and
 * the house location has no edit screen anywhere in the app, so for that field
 * "later" means never.
 *
 * The sentences are deliberately plain and short: this is the one screen that
 * has to be understood by someone who found the rest of the form hard. It is
 * built from what was entered, in their own language, and read aloud where a
 * voice exists.
 */

export type ReviewFarm = {
  index: number;
  area: string;
  soilLabel: string;
  irrigationLabel: string;
  cropName: string;
  seedingDate: string;
};

export default function ReviewStep({
  name,
  place,
  farms,
  saving,
  onBack,
  onConfirm,
}: {
  name: string;
  /** District and state where possible, else whatever the geocoder returned. */
  place: string;
  farms: ReviewFarm[];
  saving: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t, locale } = useT();

  /**
   * Passing the real locale, not the English-only constant the dashboard's
   * SpeakButton uses. Hindi and English have device voices; the rest fall
   * through to the server and, if it is not running, `available` goes false and
   * the button below simply does not render. Silence is the correct failure —
   * a button that does nothing is worse than no button.
   */
  const { speak, cancel, speaking, available, unlock } = useTextToSpeech(locale);

  const sentences = farms.map((f) =>
    t("onboarding.review.sentence", {
      n: f.index,
      place,
      soil: f.soilLabel,
      water: f.irrigationLabel,
      area: f.area,
      crop: f.cropName,
    })
  );

  const readAloud = () => {
    if (speaking) {
      cancel();
      return;
    }
    unlock(); // must happen inside the click, for the autoplay policy
    void speak([t("onboarding.review.greeting", { name }), ...sentences].join(". "));
  };

  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-af-ink">
            {t("onboarding.review.title")}
          </h3>
          <p className="mt-1 text-sm text-af-ink-2">{t("onboarding.review.subtitle")}</p>
        </div>

        {available && (
          <button
            type="button"
            onClick={readAloud}
            className="inline-flex shrink-0 items-center gap-2 rounded-[12px] border border-af-border bg-af-card px-4 py-2.5 text-sm font-semibold text-af-ink transition hover:border-af-primary/40"
          >
            {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-af-primary" />}
            {speaking ? t("voice.stop") : t("voice.playReply")}
          </button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {farms.map((f, i) => (
          <div key={f.index} className="rounded-[16px] border border-af-border bg-af-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-af-primary text-[11px] font-bold text-white">
                {f.index}
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-af-muted">
                {t("onboarding.farm.n", { n: f.index })}
              </span>
            </div>
            {/* One sentence, not a table of labelled fields. A table is a form;
                a sentence is something you can check by reading it once. */}
            <p className="mt-2 text-[15px] leading-relaxed text-af-ink">{sentences[i]}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-af-muted">
              <MapPin className="h-3.5 w-3.5" />
              {t("onboarding.review.sownOn", { date: f.seedingDate })}
            </p>
          </div>
        ))}
      </div>

      {/* Both actions are the same size on purpose. Making "go back" small and
          grey is how a farmer who spotted a mistake ends up confirming it. */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-af-border bg-af-card px-5 py-4 text-[15px] font-semibold text-af-ink transition hover:bg-af-bg disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("onboarding.review.change")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-af-primary px-5 py-4 text-[15px] font-semibold text-white transition hover:bg-af-primary-deep active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("onboarding.review.confirm")}
        </button>
      </div>
    </div>
  );
}
