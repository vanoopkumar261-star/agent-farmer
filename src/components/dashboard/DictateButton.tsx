"use client";

import { useEffect, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { VOICE_LOCALE, voiceEnabledFor, voiceInputSupported } from "@/lib/speech";

/**
 * One-shot dictation into the message box — press, speak, the words appear.
 *
 * This is the lighter half of voice: it fills the input rather than starting a
 * conversation, so the farmer can check and edit what was heard before sending.
 * Interim results stream in live on Web Speech; on the Whisper fallback the
 * text arrives once recording stops, which is what the spinner covers.
 */
export default function DictateButton({
  onText,
  disabled,
}: {
  /** Receives the transcript — the composer appends it to the input. */
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useT();
  const [error, setError] = useState<string | null>(null);
  // Capability must be read AFTER hydration. `voiceInputSupported()` touches
  // `window`, so it is false during server rendering; checking it inline made
  // the server emit no button and React kept that markup, so the microphone
  // never appeared even though the browser fully supported it.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(voiceInputSupported()), []);

  // Voice is English-only; see VOICE_LOCALES in lib/speech.ts.
  const enabled = supported && voiceEnabledFor(locale);

  const { start, stop, listening, transcribing, interim } = useSpeechRecognition({
    locale: VOICE_LOCALE,
    onResult: (text) => {
      setError(null);
      onText(text);
    },
    onError: (err) => {
      if (err === "permission") setError(t("voice.micBlocked"));
      else if (err === "no-speech") setError(t("voice.noSpeech"));
      else if (err !== "network") setError(t("voice.failed"));
    },
  });

  // Nothing to show where the browser cannot take microphone input, or where
  // the app is running in a language voice does not cover.
  if (!enabled) return null;

  const busy = listening || transcribing;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (listening ? stop() : (setError(null), start()))}
        disabled={disabled || transcribing}
        aria-label={listening ? t("voice.stopDictation") : t("voice.dictate")}
        title={listening ? t("voice.stopDictation") : t("voice.dictate")}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-af-primary/45 disabled:opacity-40 disabled:pointer-events-none ${
          listening
            ? "bg-af-danger/10 text-af-danger"
            : "text-af-muted hover:bg-af-sage hover:text-af-secondary"
        }`}
      >
        {transcribing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : listening ? (
          <Square className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Live feedback sits above the composer so it never shifts the layout. */}
      {busy && (
        <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-af-secondary px-2.5 py-1 text-[11px] font-semibold text-white max-w-[60vw] truncate">
          {interim || (transcribing ? t("voice.transcribing") : t("voice.listening"))}
        </span>
      )}
      {error && !busy && (
        <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-af-danger/10 px-2.5 py-1 text-[11px] font-semibold text-af-danger">
          {error}
        </span>
      )}
    </div>
  );
}
