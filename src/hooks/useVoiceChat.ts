"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTextToSpeech } from "./useTextToSpeech";
import { toSpeakableText } from "@/lib/plainText";

export type VoicePhase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

// Voice-activity detection. Tuned for a phone held at arm's length in a field:
// loud background means the floor must sit above ambient, so it adapts.
const SPEECH_MARGIN = 0.018; // RMS above the ambient floor that counts as speech
const SILENCE_MS = 1300; // quiet this long after speech ends the utterance
const NO_SPEECH_MS = 9000; // never spoke: give up and listen again
const MAX_UTTERANCE_MS = 25000;
const MIN_SPEECH_MS = 350; // ignore coughs and door slams shorter than this

/**
 * The full voice conversation.
 *
 *   listening → transcribing → thinking → speaking → listening → …
 *
 * Listening is MediaRecorder + a silence detector, then POST /api/transcribe
 * (Groq Whisper). Speaking is Chatterbox via useTextToSpeech. The mic is
 * never open while the assistant talks — otherwise it transcribes its own
 * reply and the conversation runs away by itself.
 */
export function useVoiceChat({
  send,
  active,
  locale,
}: {
  /** Sends a message and resolves with the assistant's full reply. */
  send: (text: string, localeOverride?: string) => Promise<string>;
  /** True while voice mode is open; going false tears everything down. */
  active: boolean;
  /** Language the farmer speaks and the assistant answers in. */
  locale: string;
}) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0);
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tts = useTextToSpeech(locale);

  const activeRef = useRef(active);
  const localeRef = useRef(locale);
  const sendRef = useRef(send);
  const ttsRef = useRef(tts);
  useEffect(() => {
    activeRef.current = active;
    localeRef.current = locale;
    sendRef.current = send;
    ttsRef.current = tts;
  });

  // Recording state, torn down by `stopCapture`.
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  // Bumped on every start/abort so a stale turn can tell it was superseded.
  const turnRef = useRef(0);

  const stopCapture = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const startListeningRef = useRef<() => void>(() => {});

  const runTurn = useCallback(async (blob: Blob, turn: number) => {
    const alive = () => activeRef.current && turn === turnRef.current;
    const relisten = (delay = 150) =>
      setTimeout(() => alive() && startListeningRef.current(), delay);

    setPhase("transcribing");
    let text = "";
    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      form.append("locale", localeRef.current);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!alive()) return;
        setError("Could not hear that. Please try again.");
        relisten(600);
        return;
      }
      text = String(data?.text ?? "").trim();
    } catch {
      if (!alive()) return;
      setError("Could not hear that. Please try again.");
      relisten(600);
      return;
    }
    if (!alive()) return;
    if (!text) {
      relisten();
      return;
    }

    setLastQuestion(text);
    setLastReply("");
    setError(null);
    setPhase("thinking");

    let reply = "";
    try {
      reply = await sendRef.current(text, localeRef.current);
    } catch {
      if (alive()) setError("Something went wrong. Please try again.");
    }
    if (!alive()) return;

    if (reply) {
      // The model answers in Markdown; flatten it for both the screen and the voice.
      const spoken = toSpeakableText(reply);
      setLastReply(spoken);
      setPhase("speaking");
      await ttsRef.current.speak(spoken);
    }
    if (!alive()) return;
    startListeningRef.current();
  }, []);

  const startListening = useCallback(async () => {
    if (!activeRef.current) return;
    const turn = ++turnRef.current;
    setError(null);
    setPhase("listening");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      if (turn === turnRef.current && activeRef.current) {
        setError("Microphone access was blocked. Allow it in your browser to use voice.");
        setPhase("idle");
      }
      return;
    }
    if (turn !== turnRef.current || !activeRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : undefined;
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    discardRef.current = false;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stopCapture();
      if (discardRef.current || turn !== turnRef.current || !activeRef.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size < 1500) {
        setTimeout(() => activeRef.current && turn === turnRef.current && startListeningRef.current(), 150);
        return;
      }
      void runTurn(blob, turn);
    };
    recorderRef.current = recorder;

    // Level meter + silence detector on the same stream.
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    recorder.start(250);
    const t0 = performance.now();
    let floor = 0.01; // ambient noise estimate
    let speechStart = 0;
    let lastVoice = 0;

    const tick = () => {
      if (recorder.state === "inactive") return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      setLevel(Math.min(1, rms * 8));

      const voiced = rms > floor + SPEECH_MARGIN;
      if (voiced) {
        if (!speechStart) speechStart = now;
        lastVoice = now;
      } else if (!speechStart) {
        // Only learn the ambient level while nobody is talking.
        floor = floor * 0.95 + rms * 0.05;
      }

      const spoke = speechStart && lastVoice - speechStart >= MIN_SPEECH_MS;
      const endedSpeech = spoke && now - lastVoice > SILENCE_MS;
      const neverSpoke = !speechStart && now - t0 > NO_SPEECH_MS;
      const tooLong = now - t0 > MAX_UTTERANCE_MS;

      if (endedSpeech || tooLong) {
        recorder.stop();
        return;
      }
      if (neverSpoke) {
        discardRef.current = true;
        recorder.stop();
        // Silence is normal in a hands-free loop; open a fresh window.
        setTimeout(() => activeRef.current && turn === turnRef.current && startListeningRef.current(), 100);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [runTurn, stopCapture]);

  useEffect(() => {
    startListeningRef.current = () => void startListening();
  }, [startListening]);

  /** Hard stop: discard any capture and silence the voice. */
  const abort = useCallback(() => {
    turnRef.current += 1;
    discardRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
    stopCapture();
    ttsRef.current.cancel();
    setPhase("idle");
  }, [stopCapture]);

  /** Called from the click that opens voice mode — that gesture unlocks audio. */
  const begin = useCallback(() => {
    setError(null);
    setLastQuestion("");
    setLastReply("");
    ttsRef.current.unlock();
    void startListening();
  }, [startListening]);

  /** Tap the orb: skip the rest of the reply and talk now, or end a long utterance early. */
  const interrupt = useCallback(() => {
    if (phase === "speaking") {
      turnRef.current += 1;
      ttsRef.current.cancel();
      void startListening();
    } else if (phase === "listening" && recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, [phase, startListening]);

  useEffect(() => {
    if (!active) abort();
  }, [active, abort]);

  useEffect(() => abort, [abort]);

  return {
    phase,
    level,
    lastQuestion,
    lastReply,
    error,
    begin,
    end: abort,
    interrupt,
    /** The voice server could not be reached — the reply is shown as text only. */
    voiceFailed: tts.failed,
  };
}
