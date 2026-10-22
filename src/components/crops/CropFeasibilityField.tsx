"use client";

import { useEffect } from "react";
import type { FieldConditions } from "@/lib/cropFeasibility";
import { useCropFeasibility } from "./useCropFeasibility";
import CropFeasibilityNotice from "./CropFeasibilityNotice";

/**
 * The feasibility check as a self-contained component, for callers that render
 * a crop box per farm inside a loop.
 *
 * The onboarding wizard draws one of these for each of up to four plots. Hooks
 * cannot be called from inside a `.map`, so the hook lives here — one instance
 * per farm, each with its own debounce and its own in-flight request — and the
 * verdict is reported back up through `onVerdict` so the parent's "Continue"
 * guard can see every plot at once.
 *
 * `onVerdict` is called on change only, and the effect depends on the boolean
 * rather than the result object, so a parent that stores it in state does not
 * drive a render loop.
 */
export default function CropFeasibilityField({
  cropName,
  conditions,
  enabled = true,
  onVerdict,
  onPickAlternative,
}: {
  cropName: string;
  conditions: FieldConditions;
  enabled?: boolean;
  /** Called with true when this crop cannot be grown on this plot. */
  onVerdict?: (blocked: boolean) => void;
  onPickAlternative?: (crop: string) => void;
}) {
  const state = useCropFeasibility(cropName, conditions, enabled);

  useEffect(() => {
    onVerdict?.(state.blocked);
    // `onVerdict` is intentionally not a dependency: callers pass an inline
    // arrow, which is a new function every render, and including it would fire
    // this effect on every render rather than when the verdict changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocked]);

  return <CropFeasibilityNotice state={state} onPickAlternative={onPickAlternative} />;
}
