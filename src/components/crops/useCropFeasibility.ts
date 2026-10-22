"use client";

import { useEffect, useRef, useState } from "react";
import {
  assessCropFeasibility,
  type FeasibilityResult,
  type FieldConditions,
} from "@/lib/cropFeasibility";

/**
 * Judges a freehand crop name against the field as the farmer types it.
 *
 * Two tiers, same as the API route, and the split is what makes this usable:
 *
 *   - For the 25 crops the engine knows, the verdict is computed **in the
 *     browser**, synchronously, from the table in `src/lib/cropFeasibility.ts`.
 *     No request, no spinner, no latency — the warning appears as the farmer
 *     finishes the word.
 *   - Only a name the table has never heard of goes to `/api/crop-feasibility`,
 *     which asks Groq whether it is a crop at all and whether it suits this
 *     field. That is debounced, because it costs tokens and a round-trip.
 *
 * ── What it deliberately does not do ─────────────────────────────────────────
 *
 * It never blocks on the network. While the model call is in flight the hook
 * reports `checking`, and the caller keeps the save button enabled unless a
 * verdict has actually come back `unsuitable`. A farmer on a weak rural
 * connection must not be locked out of their own form by a check that is
 * advisory in the first place.
 */

/** How long after the last keystroke the unknown-name lookup fires. */
const DEBOUNCE_MS = 700;

export type FeasibilityState = {
  result: FeasibilityResult | null;
  checking: boolean;
  /** True only when a verdict came back `unsuitable`. Drives the save guard. */
  blocked: boolean;
};

export function useCropFeasibility(
  cropName: string,
  conditions: FieldConditions,
  enabled = true
): FeasibilityState {
  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Conditions is a fresh object every render, so it cannot be a dependency.
  // Serialising it gives a stable key that still changes when a value does.
  const condKey = JSON.stringify(conditions);

  // Guards a late response from overwriting a newer one: each run takes a
  // ticket and only the current ticket may publish.
  const runRef = useRef(0);

  useEffect(() => {
    const crop = cropName.trim();
    const run = ++runRef.current;

    if (!enabled || !crop) {
      setResult(null);
      setChecking(false);
      return;
    }

    const parsed: FieldConditions = JSON.parse(condKey);
    const local = assessCropFeasibility(crop, parsed);

    // Known crop — answered locally, immediately.
    if (local.verdict !== "unknown") {
      setResult(local);
      setChecking(false);
      return;
    }

    // Unknown name: wait for typing to settle, then ask the model.
    setChecking(true);
    setResult(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/crop-feasibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop, conditions: parsed }),
        });
        if (run !== runRef.current) return;
        if (!res.ok) {
          // Rate-limited, signed out, offline. Say nothing rather than
          // inventing a verdict — the server validates on save regardless.
          setResult(null);
          return;
        }
        setResult((await res.json()) as FeasibilityResult);
      } catch {
        if (run === runRef.current) setResult(null);
      } finally {
        if (run === runRef.current) setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [cropName, condKey, enabled]);

  return {
    result,
    checking,
    blocked: result?.verdict === "unsuitable",
  };
}
