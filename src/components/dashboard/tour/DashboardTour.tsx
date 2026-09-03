"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useT } from "@/components/i18n/LanguageProvider";
import { markTourSeen, shouldRunTour } from "@/lib/tour";
import { TOUR_STEPS, type TourStep } from "./steps";

/**
 * First-run tutorial: dims the dashboard and walks the farmer through it one
 * real element at a time.
 *
 * Deliberately not called Spotlight-anything — `SpotlightLayer` and the
 * `.af-spotlight` class are the existing cursor-follow hover glow, and reusing
 * that name here would conflate two unrelated systems.
 *
 * The single most important property: **this can never trap anyone.** A missing
 * anchor, a failed measurement or a failed database write all end with the
 * overlay closed. Skip is reachable from every step, from the keyboard, and by
 * clicking the backdrop. A tutorial that blocks the app is worse than no
 * tutorial, especially for someone on their first smartphone.
 */

type Rect = { top: number; left: number; width: number; height: number };

/** Breathing room between the highlight and the card, in px. */
const GAP = 14;
/** How far the card is kept from the viewport edge. */
const MARGIN = 12;
const CARD_WIDTH = 340;

function anchorEl(anchor: string | null): HTMLElement | null {
  if (!anchor) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
}

/**
 * Is this step showable right now?
 *
 * An anchored step needs an element that exists *and* occupies space. The
 * second half is what handles `hidden lg:flex` on the sidebar: below 1024px the
 * element is still in the DOM but measures 0×0, and highlighting nothing would
 * look broken.
 */
function isStepVisible(step: TourStep): boolean {
  if (!step.anchor) return true;
  const el = anchorEl(step.anchor);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export default function DashboardTour({
  farmerId,
  preferences,
}: {
  farmerId: string;
  preferences: Record<string, any> | null | undefined;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  /**
   * Decide once, on mount, which steps this particular dashboard can show.
   *
   * Fixed for the run: recomputing mid-tour would renumber the steps under the
   * farmer if they rotated their phone, and "3 of 8" turning into "3 of 9"
   * mid-sentence is worse than one stale step count.
   */
  useEffect(() => {
    if (!shouldRunTour(preferences)) return;
    // One frame, so the dashboard's own entrance animations have laid out and
    // conditional cards have committed before anything is measured.
    const id = window.requestAnimationFrame(() => {
      const usable = TOUR_STEPS.filter(isStepVisible);
      // Nothing but the two centred cards means the page hasn't rendered as
      // expected; showing a contentless tour would be worse than skipping it.
      if (usable.filter((s) => s.anchor).length === 0) return;
      setSteps(usable);
      setOpen(true);
      restoreFocus.current = document.activeElement as HTMLElement | null;
    });
    return () => window.cancelAnimationFrame(id);
  }, [preferences]);

  const step = steps[i];

  const close = useCallback(async () => {
    setOpen(false);
    restoreFocus.current?.focus?.();
    // Persistence must not gate the close — see the class comment.
    void markTourSeen(farmerId);
  }, [farmerId]);

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.anchor) {
      setRect(null);
      return;
    }
    const el = anchorEl(step.anchor);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();

    // Clamp to the viewport. An anchor taller than the screen — a sticky
    // full-height column, a long list — would otherwise cut a hole with its
    // edges off-screen and shove the card out of view entirely. Highlighting
    // the visible portion is both accurate and always placeable.
    const top = Math.max(0, r.top);
    const left = Math.max(0, r.left);
    const bottom = Math.min(window.innerHeight, r.bottom);
    const right = Math.min(window.innerWidth, r.right);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    // Barely on screen — a scroll that has not settled, or an anchor that
    // cannot be brought into view. A 10px sliver of highlight at the viewport
    // edge points at nothing and drags the card off with it, so fall back to a
    // centred card with no highlight. The farmer still reads the step.
    if (width < 24 || height < 24) {
      setRect(null);
      return;
    }

    setRect({ top, left, width, height });
  }, [step]);

  // Bring the anchor into view, then measure. Layout effect so the highlight
  // never paints at a stale position for a frame.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = anchorEl(step.anchor);
    if (el) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }
    measure();
    // Re-measure after the smooth scroll settles.
    const id = window.setTimeout(measure, 380);
    return () => window.clearTimeout(id);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    // Capture phase: the dashboard scrolls on the window, but a step could sit
    // inside a scrollable card.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  const next = useCallback(() => {
    setI((n) => (n + 1 < steps.length ? n + 1 : n));
  }, [steps.length]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  const isLast = i === steps.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void close();
      } else if (e.key === "ArrowRight") {
        isLast ? void close() : next();
      } else if (e.key === "ArrowLeft") {
        back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isLast, next, back, close]);

  /*
   * Note: the page is deliberately NOT scroll-locked while the tour runs.
   *
   * The obvious `body { overflow: hidden }` breaks the tour outright — it also
   * blocks `scrollIntoView`, so any step whose anchor is off-screen can never
   * be scrolled to. The sidebar step is the clear case: its nav sits at the top
   * of a full-height column, and by step 8 the page has scrolled a thousand
   * pixels past it, leaving the highlight pinned to a sliver at the viewport
   * edge.
   *
   * Letting the page scroll costs nothing, because the highlight is recomputed
   * on every scroll event and simply follows its element.
   */

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, i]);

  /**
   * Where the card goes: below the highlight if there is room, otherwise above,
   * always clamped inside the viewport. Centred when the step has no anchor.
   */
  const cardStyle = useMemo((): React.CSSProperties => {
    if (typeof window === "undefined" || !rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.top + rect.height + GAP;
    const estimated = cardRef.current?.offsetHeight ?? 180;
    const fitsBelow = below + estimated + MARGIN <= vh;

    const top = fitsBelow ? below : Math.max(MARGIN, rect.top - GAP - estimated);
    const width = Math.min(CARD_WIDTH, vw - MARGIN * 2);
    const rawLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(MARGIN, rawLeft), vw - width - MARGIN);

    return { top, left, width };
  }, [rect]);

  if (!open || !step || typeof document === "undefined") return null;

  const body = (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={t("tour.aria")}>
      {/*
        The dim and the hole in one element: a box matching the anchor with a
        viewport-swallowing shadow spread. No mask, no four-panel geometry.
        When there is no anchor it becomes a plain full-screen scrim.
      */}
      {rect ? (
        <div
          className="absolute rounded-2xl ring-2 ring-af-primary/70 pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(23,59,42,0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(23,59,42,0.62)" }} />
      )}

      {/* Backdrop click skips. Sits under the card, over the dimmed page. */}
      <button
        aria-label={t("tour.skip")}
        tabIndex={-1}
        onClick={() => void close()}
        className="absolute inset-0 w-full h-full cursor-default"
      />

      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className="absolute rounded-2xl bg-af-card border border-af-border shadow-af-float p-5 outline-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-af-primary" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase text-af-muted">
            {t("tour.stepCounter", { n: i + 1, total: steps.length })}
          </span>
        </div>

        <h2 className="text-[15px] font-semibold text-af-ink mt-2 leading-snug">
          {t(step.titleKey)}
        </h2>
        <p className="text-[13px] text-af-ink-2 mt-1.5 leading-relaxed">{t(step.bodyKey)}</p>

        {/* Progress dots — a wordless "how much is left", which matters when
            the farmer may not be reading the counter. */}
        <div className="flex items-center gap-1.5 mt-4">
          {steps.map((s, n) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-4 bg-af-primary" : "w-1.5 bg-af-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            onClick={() => void close()}
            className="text-[12.5px] font-medium text-af-muted hover:text-af-ink transition"
          >
            {t("tour.skip")}
          </button>

          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={back}
                aria-label={t("tour.back")}
                className="inline-flex items-center gap-1 rounded-lg border border-af-border px-2.5 py-1.5 text-[12.5px] font-medium text-af-ink hover:border-af-primary/40 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("tour.back")}
              </button>
            )}
            <button
              onClick={() => (isLast ? void close() : next())}
              className="inline-flex items-center gap-1.5 rounded-lg bg-af-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-af-primary-deep transition"
            >
              {isLast ? t("tour.finish") : t("tour.next")}
              {isLast ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
