"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bcp47,
  getSpeechRecognitionCtor,
  mediaRecorderSupported,
  webSpeechRecognitionSupported,
} from "@/lib/speech";

export type RecognitionError = "permission" | "no-speech" | "network" | "unsupported" | "failed";

/**
 * Turns speech into text, hiding which of two engines did the work.
 *
 * Primary: the browser's Web Speech API — free, no round-trip, and it streams
 * interim results so words appear while the farmer is still talking.
 *
 * Fallback: MediaRecorder + POST /api/transcribe (Groq Whisper), used where
 * Web Speech is missing (Firefox) or dies with a network error. That path can
 * only deliver text once recording stops, so `interim` stays empty there and
 * the UI shows a "transcribing" state instead.
 */
export function useSpeechRecognition({
  locale,
  onResult,
  onError,
  forceFallback = false,
}: {
  locale: string;
  /** Fires once per completed utterance with the final text. */
  onResult: (text: string) => void;
  onError?: (error: RecognitionError) => void;
  /**
   * Skip Web Speech and record for Whisper instead. The caller sets this after
   * a `network` error, since Web Speech depends on a cloud service that can be
   * unreachable even when the app itself is fine.
   */
  forceFallback?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  // Distinguishes a stop we asked for from the engine ending on its own, so a
  // deliberate stop never looks like an error.
  const intentionalStop = useRef(false);

  // Latest callbacks without re-creating the engine on every parent render.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  });

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ───────────────────────── Whisper fallback path ───────────────────────── */

  const startRecording = useCallback(async () => {
    if (!mediaRecorderSupported()) {
      onErrorRef.current?.("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        releaseStream();
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size === 0) {
          onErrorRef.current?.("no-speech");
          return;
        }

        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "speech.webm");
          form.append("locale", locale);
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            onErrorRef.current?.("failed");
            return;
          }
          const text = (data?.text ?? "").trim();
          if (text) onResultRef.current(text);
          else onErrorRef.current?.("no-speech");
        } catch {
          onErrorRef.current?.("failed");
        } finally {
          setTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch {
      // getUserMedia rejects when the farmer denies the mic prompt.
      onErrorRef.current?.("permission");
    }
  }, [locale, releaseStream]);

  /* ────────────────────────── Web Speech main path ───────────────────────── */

  const startWebSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      void startRecording();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = bcp47(locale);
    recognition.interimResults = true;
    // One utterance per start. Continuous mode keeps the mic hot between turns,
    // which in a speak-back loop means the assistant's own voice gets captured.
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = "";

    recognition.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
    };

    recognition.onerror = (event: any) => {
      const code = event?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        onErrorRef.current?.("permission");
      } else if (code === "no-speech") {
        onErrorRef.current?.("no-speech");
      } else if (code === "network") {
        // Web Speech needs Google's service; drop to Whisper rather than fail.
        onErrorRef.current?.("network");
      } else if (code !== "aborted") {
        onErrorRef.current?.("failed");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) onResultRef.current(text);
      else if (!intentionalStop.current) onErrorRef.current?.("no-speech");
      intentionalStop.current = false;
    };

    recognitionRef.current = recognition;
    intentionalStop.current = false;
    setInterim("");
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if called while already running; treat as already on.
      setListening(true);
    }
  }, [locale, startRecording]);

  const start = useCallback(() => {
    if (listening || transcribing) return;
    if (!forceFallback && webSpeechRecognitionSupported()) startWebSpeech();
    else void startRecording();
  }, [listening, transcribing, forceFallback, startWebSpeech, startRecording]);

  /** Ends the current utterance. Any captured speech still resolves normally. */
  const stop = useCallback(() => {
    intentionalStop.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setListening(false);
  }, []);

  /** Hard stop that discards whatever was captured — used when exiting. */
  const abort = useCallback(() => {
    intentionalStop.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* already gone */
      }
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    chunksRef.current = [];
    releaseStream();
    setListening(false);
    setTranscribing(false);
    setInterim("");
  }, [releaseStream]);

  useEffect(() => abort, [abort]);

  return { start, stop, abort, listening, transcribing, interim };
}
