"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTextToSpeech } from "./useTextToSpeech";
import { useSpeechRecognition, type RecognitionError } from "./useSpeechRecognition";
import { VOICE_LOCALE } from "@/lib/speech";
import { toSpeakableText } from "@/lib/plainText";

export type VoicePhase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

/**
 * The hands-free conversation loop behind voice mode.
 *
 *   listening → (transcribing) → thinking → speaking → listening → …
 *
 * One button starts it and it keeps cycling until the farmer ends it.
 *
 * The rule that makes this work: the microphone is NEVER open while the
 * assistant is talking. Recognition is stopped before `speak()` and only
 * restarted after the utterance finishes. Skip that and the mic picks up the
 * assistant's own reply, transcribes it, sends it as the next question and the
 * conversation runs away by itself.
 */
export function useVoiceConversation({
  send,
  active,
}: {
  /** Sends a message and resolves with the assistant's full reply. */
  send: (text: string, localeOverride?: string) => Promise<string>;
  /** True while voice mode is open; going false tears everything down. */
  active: boolean;
}) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preferFallback, setPreferFallback] = useState(false);

  // The whole exchange runs in English: we listen in English, ask for an
  // English reply, and read it back with an English voice. Mixing those would
  // mean an English voice attempting Tamil script.
  const tts = useTextToSpeech(VOICE_LOCALE);

  // Read inside async callbacks that outlive a render, so a turn finishing
  // after the farmer hit End doesn't restart the microphone.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const ttsRef = useRef(tts);
  useEffect(() => {
    ttsRef.current = tts;
  });

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // Assigned below; needed here because handleResult restarts listening.
  const startListeningRef = useRef<() => void>(() => {});

  const handleResult = useCallback(async (text: string) => {
    if (!activeRef.current) return;

    setLastQuestion(text);
    setLastReply("");
    setError(null);
    setPhase("thinking");

    let reply = "";
    try {
      reply = await sendRef.current(text, VOICE_LOCALE);
    } catch {
      setError("Something went wrong. Please try again.");
    }

    if (!activeRef.current) return;

    if (reply) {
      // The model answers in Markdown. Voice mode both SHOWS this text at 19px
      // and reads it aloud, so the syntax has to go: unstripped, the seven
      // languages with no installed voice read "star star" on screen, and the
      // two with one hear it. Markdown is not rendered here — the layout is a
      // single centred block meant to be read across a room, and centred
      // bullets would fight that — so it is flattened to plain prose instead.
      const spoken = toSpeakableText(reply);
      setLastReply(spoken);
      // Silent languages fall through instantly: `speak` resolves immediately
      // when the device has no voice, so the loop still works as voice-in.
      setPhase("speaking");
      await ttsRef.current.speak(spoken);
    }

    if (!activeRef.current) return;
    startListeningRef.current();
  }, []);

  const handleError = useCallback((err: RecognitionError) => {
    if (!activeRef.current) return;

    if (err === "permission") {
      setError("Microphone access was blocked. Allow it in your browser to use voice.");
      setPhase("idle");
      return;
    }
    if (err === "network") {
      // Web Speech's cloud service is unreachable — switch engines and retry.
      setPreferFallback(true);
      setTimeout(() => activeRef.current && startListeningRef.current(), 80);
      return;
    }
    if (err === "no-speech") {
      // Silence is normal in a hands-free loop; just listen again.
      setTimeout(() => activeRef.current && startListeningRef.current(), 80);
      return;
    }
    setError("Could not hear that. Please try again.");
    setTimeout(() => activeRef.current && startListeningRef.current(), 400);
  }, []);

  const recognition = useSpeechRecognition({
    locale: VOICE_LOCALE,
    onResult: handleResult,
    onError: handleError,
    forceFallback: preferFallback,
  });

  const recognitionRef = useRef(recognition);
  useEffect(() => {
    recognitionRef.current = recognition;
  });

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    setPhase("listening");
    recognitionRef.current.start();
  }, []);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  /** Called from the button that opens voice mode — that gesture unlocks TTS. */
  const begin = useCallback(() => {
    setError(null);
    setLastQuestion("");
    setLastReply("");
    ttsRef.current.unlock();
    startListening();
  }, [startListening]);

  const end = useCallback(() => {
    recognitionRef.current.abort();
    ttsRef.current.cancel();
    setPhase("idle");
  }, []);

  // Closing voice mode must stop the mic and the voice, not just hide the UI.
  useEffect(() => {
    if (!active) {
      recognitionRef.current.abort();
      ttsRef.current.cancel();
      setPhase("idle");
    }
  }, [active]);

  // Keep the phase honest while the fallback engine uploads audio.
  useEffect(() => {
    if (recognition.transcribing) setPhase("transcribing");
  }, [recognition.transcribing]);

  return {
    phase,
    interim: recognition.interim,
    lastQuestion,
    lastReply,
    error,
    begin,
    end,
    /** False when the device has no English voice at all — UI says so. */
    canSpeak: tts.available,
  };
}
