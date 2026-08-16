"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import IndiaMap, { Branch } from "./IndiaMap";

/**
 * Bengaluru only, because Bengaluru is the only office there is.
 *
 * The Arva reference carries two extra unlabelled dots, and mirroring them
 * would have meant inventing locations — an unlabelled pin on a "where you can
 * find us" map still reads as a place the company operates from. Add real ones
 * here when they exist; IndiaMap projects from coordinates, so a new branch is
 * one more entry, not a redraw.
 */
const BRANCHES: Branch[] = [
  {
    id: "blr",
    label: ["BENGALURU", "KARNATAKA · HQ"],
    lat: 12.9716,
    lng: 77.5946,
    primary: true,
    labelAnchor: "right",
  },
];

type Status = "idle" | "sending" | "sent" | "error";

/**
 * "Where you can find us" — the feedback form paired with a map of India.
 *
 * Follows the Arva reference band: forest ground, form on the left, outline map
 * with glowing pins on the right. Two departures, both deliberate:
 *
 * · The reference collects an email for a newsletter. This collects a message
 *   too, because a feedback form that captures only an address collects no
 *   feedback.
 * · The reference runs reCAPTCHA. That needs a Google key, a third-party script
 *   on every landing-page view, and it blocks some users outright. A honeypot
 *   field costs nothing and stops the automated submissions this will actually
 *   see; if real spam starts arriving, that is the moment to add a challenge.
 */
export default function FindUs() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // Whether the alert email actually went out. The route reports this rather
  // than failing, so the confirmation can promise only what really happened —
  // the feedback is stored either way, but "the team has been notified" is a
  // lie when the mail provider is unconfigured or down.
  const [notified, setNotified] = useState(true);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSubmit = emailValid && message.trim().length >= 4 && consent && status !== "sending";

  const submit = async () => {
    if (!canSubmit) return;
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), message: message.trim(), company }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setNotified(data?.notified !== false);
      setStatus("sent");
      setEmail("");
      setMessage("");
      setConsent(false);
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <section className="bg-forest-ink">
      <div className="mx-auto max-w-[1200px] px-6 py-[80px]">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-10">
          {/* ── Feedback form ───────────────────────────────────────────── */}
          <div>
            <h2 className="font-sans text-[15px] font-medium uppercase tracking-[0.06em] text-white">
              Feedback
            </h2>
            <p className="mt-1.5 font-sans text-[16px] font-light text-white/75">
              Tell us what would make Agent Farmer more useful on your farm.
            </p>

            {status === "sent" ? (
              <div className="mt-8 flex items-start gap-3 rounded-arva-card border border-vivid-lime/30 bg-vivid-lime/10 px-5 py-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-vivid-lime" />
                <div>
                  <p className="font-sans text-[15px] font-semibold text-white">
                    Thank you — we have it.
                  </p>
                  <p className="mt-1 font-sans text-[14px] font-light text-white/75">
                    {notified
                      ? "Your feedback is saved and the team has been notified."
                      : "Your feedback is saved. We'll read it as soon as we can."}
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-3 font-sans text-[14px] font-semibold text-vivid-lime underline underline-offset-4"
                  >
                    Send another
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email*"
                  aria-label="Your email"
                  className="w-full rounded-arva-input border border-white/25 bg-transparent px-6 py-4 font-sans text-[15px] text-white outline-none transition placeholder:text-white/45 focus:border-vivid-lime/70"
                />

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Your feedback*"
                  aria-label="Your feedback"
                  className="w-full resize-y rounded-[24px] border border-white/25 bg-transparent px-6 py-4 font-sans text-[15px] text-white outline-none transition placeholder:text-white/45 focus:border-vivid-lime/70"
                />

                {/* Honeypot. Hidden from people and from screen readers; only a
                    bot that fills every input will ever put anything here. */}
                <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Company
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-vivid-lime"
                  />
                  <span className="font-sans text-[14px] font-light leading-relaxed text-white/80">
                    I agree that Agent Farmer may store my email and message in order to
                    respond to this feedback.
                  </span>
                </label>

                {error && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 font-sans text-[13px] font-semibold text-peach-card"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-arva-btn bg-white px-9 py-3.5 font-sans text-[14px] font-semibold uppercase tracking-[0.06em] text-charcoal transition hover:bg-bone disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>

                <p className="pt-1 font-sans text-[13px] font-light text-white/55">
                  Agent Farmer stores your information only to respond to your request.
                </p>
              </div>
            )}
          </div>

          {/* ── Map ─────────────────────────────────────────────────────── */}
          <div className="lg:pl-6">
            <h2 className="font-sans text-[15px] font-medium uppercase tracking-[0.06em] text-white">
              Where you can find us
            </h2>
            <IndiaMap
              branches={BRANCHES}
              className="mt-6 h-auto w-full max-w-[600px] text-white lg:ml-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
