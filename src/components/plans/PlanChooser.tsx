"use client";

/**
 * The membership chooser — three tiers, a billing-cycle toggle, and the full
 * comparison matrix.
 *
 * One component, used by both the onboarding step and the Settings panel, so
 * the price a farmer agrees to during registration and the price they see when
 * changing plans later cannot drift apart. Everything it renders comes from
 * `src/lib/plans.ts`, which is also what the server enforces — a card here
 * cannot promise something the API will refuse.
 *
 * ── Why the field cap is a headline, not a bullet ────────────────────────────
 *
 * During onboarding this screen comes *before* the farmer enters any fields,
 * so the cap is a promise about a step they have not reached. It is also the
 * limit most likely to bite them later. Burying "up to 5 fields" in a tick-list
 * would mean discovering it at the moment they are refused.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import LaserFlow from "./LaserFlow";
import { Check, ChevronDown, Minus, Sparkles, Lock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { useT } from "@/components/i18n/LanguageProvider";
import {
  MATRIX_ROWS,
  PLANS,
  PLAN_ORDER,
  annualSavingMonths,
  annualSavingRupees,
  annualAtMonthlyRate,
  featureOf,
  fieldLimit,
  priceFor,
  type Cycle,
  type PlanId,
} from "@/lib/plans";

/**
 * The beam's colour.
 *
 * LaserFlow keeps only the *hue and saturation* of this value — `toHsv` throws
 * the brightness away — and derives its whole sixteen-tone palette by rotating
 * that hue. So a near-black green reads as a strongly saturated green here,
 * not as mud: #124812 carries 75% saturation, where the brand's #284D35 only
 * carries 48% and does wash out.
 */
const BEAM_COLOR = "#124812";

export default function PlanChooser({
  current,
  fieldCount,
  busyPlan,
  mode,
  onChoose,
}: {
  current?: PlanId;
  /**
   * Existing fields. Undefined during onboarding, where none exist yet; a real
   * count in Settings, where it decides whether a cheaper tier is reachable
   * without deleting anything.
   */
  fieldCount?: number;
  /** The plan currently being saved, so one card can show a spinner. */
  busyPlan?: PlanId | null;
  mode: "onboarding" | "settings";
  onChoose: (plan: PlanId, cycle: Cycle) => void;
}) {
  const { t } = useT();
  const [cycle, setCycle] = useState<Cycle>("annual");
  /**
   * The full matrix is fifteen rows, and open by default it pushed the choice
   * itself below the fold — the farmer had to scroll past a comparison table
   * to reach the buttons it was meant to inform. Open in Settings, where the
   * farmer came specifically to compare; a disclosure during registration.
   */
  const [matrixOpen, setMatrixOpen] = useState(mode === "settings");

  /**
   * Selecting and confirming are now two steps.
   *
   * Tapping a card lifts it, dims the other two and lands the beam on it; the
   * button then commits. One tap doing both would mean the farmer never sees
   * what they picked before the wizard moves on — and on a page where the
   * whole point is comparing three things, being able to hold one up against
   * the others matters more than saving a click.
   *
   * Nothing is selected to begin with. Seeding this with a tier meant the beam
   * sat on that card before the farmer had done anything, which reads as a
   * recommendation the product is not making — and with the middle card seeded,
   * as an effect that is simply always in the middle. In Settings the farmer
   * does have a plan already, and showing it selected is a statement of fact.
   */
  const [selected, setSelected] = useState<PlanId | null>(
    mode === "settings" ? (current ?? null) : null,
  );

  const sectionRef = useRef<HTMLDivElement>(null);
  /** The stage the beam is drawn over, measured to aim it. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** Per-card nodes, so the beam can be pointed at whichever is selected. */
  const cardNodes = useRef<Partial<Record<PlanId, HTMLDivElement | null>>>({});
  /** What LaserFlow reads each frame. Kept in sync with `selected` below. */
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // The ref callback on each card already points this at the right node on
  // mount; this keeps it right when the selection changes without a remount.
  useEffect(() => {
    surfaceRef.current = (selected && cardNodes.current[selected]) ?? null;
  }, [selected]);

  /**
   * Whether to run the beam at all.
   *
   * It is a WebGL2 fragment shader with five octaves of fbm noise per pixel,
   * every frame. On the mid-range Android this app is actually built for that
   * is a real cost for decoration, and the three cards stack into a column
   * there anyway, where a beam landing on one of them reads as a glitch. So it
   * is desktop-only, and matched live rather than at mount so a window dragged
   * between screens behaves.
   */
  const [beamOn, setBeamOn] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)");
    const update = () => setBeamOn(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  /**
   * Where the beam falls, as a fraction of the stage's width.
   *
   * `surfaceRef` only decides what the beam lands *on* — the light's own
   * horizontal position is this one number, so leaving it at 0.5 pinned the
   * beam to the middle column whichever card was selected. Measured from the
   * selected card's centre instead, and re-measured when the stage resizes,
   * since three columns become one stacked card at narrow widths.
   */
  const [beamX, setBeamX] = useState(0.5);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !selected) return;

    const measure = () => {
      const node = cardNodes.current[selected];
      if (!node) return;
      const stageBox = stage.getBoundingClientRect();
      if (!stageBox.width) return;
      const cardBox = node.getBoundingClientRect();
      const centre = cardBox.left + cardBox.width / 2 - stageBox.left;
      setBeamX(Math.min(1, Math.max(0, centre / stageBox.width)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selected, cycle, beamOn]);

  const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  /**
   * Why a tier cannot be picked, or null when it can.
   *
   * Only ever about existing data: a farmer with seven fields cannot move to a
   * plan that holds five without losing two, and the honest response is to say
   * so here rather than to delete them on their behalf. The same rule is
   * enforced server-side in /api/plan — this is the visible half.
   */
  const blockedReason = useMemo(() => {
    return (id: PlanId): string | null => {
      if (fieldCount == null) return null;
      const cap = fieldLimit(id);
      if (fieldCount <= cap) return null;
      return t("plans.blocked.fields", { have: fieldCount, cap });
    };
  }, [fieldCount, t]);

  return (
    <div ref={sectionRef} className="relative">
      {/* Cycle toggle */}
      <div className="flex flex-col items-center gap-2">
        <Tabs
          tabs={[
            { id: "monthly", label: t("plans.cycle.monthly") },
            { id: "annual", label: t("plans.cycle.annual") },
          ]}
          active={cycle}
          onChange={(id) => setCycle(id as Cycle)}
        />
        {cycle === "annual" && (
          <p className="text-meta text-af-muted">{t("plans.cycle.annualNote")}</p>
        )}
      </div>

      {/* Tier cards, on a stage the beam can fall through */}
      <div ref={stageRef} className="relative mt-5">
        {beamOn && selected && (
          /*
            Behind the cards, and reaching above them so the beam has somewhere
            to fall from. The shader masks out everything inside the surface, so
            what shows is light gathering along the selected card's top edge and
            spilling past its corners — which is why it reads as the card being
            picked out rather than an effect drawn over it.
          */
          <div
            className="pointer-events-none absolute inset-x-0 -top-28 bottom-0 z-0 overflow-visible"
            aria-hidden="true"
          >
            <LaserFlow
              surfaceRef={surfaceRef}
              /*
                `theme` stays light. It is not part of the tuned look but of the
                page: the light path outputs premultiplied chroma, so only
                coloured light lands and neutral glow drops out. On dark the
                same beam leaves a white haze over the ivory card.
              */
              theme="light"
              color={BEAM_COLOR}
              /* Aimed at the selected card, not fixed at the stage's centre. */
              beamPosition={beamX}
              intensity={0.3}
              beamWidth={2.4}
              flare={2}
              spread={1.5}
              spill={1}
              fog={1.2}
              dust={1.6}
              pulse={1.4}
              seed={8}
              /*
                The reveal needs an image to show through the light; there is no
                UI screenshot in public/ yet, so these two sit ready and do
                nothing until `revealImage` is given one.
              */
              revealRadius={190}
              revealOpacity={0.6}
            />
          </div>
        )}

      <div className="relative z-10 grid gap-4 md:grid-cols-3 items-stretch">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const price = priceFor(plan, cycle);
          // Only meaningful in Settings. During onboarding `current` seeds the
          // initial selection from the wizard's draft, and treating that as
          // "your current plan" disabled the Free card's own button before the
          // farmer had chosen anything at all.
          const isCurrent = mode === "settings" && current === id;
          const blocked = blockedReason(id);
          const saving = annualSavingMonths(plan);
          const onCard = plan.features.filter((f) => f.onCard);

          const isSelected = selected === id && !blocked;
          // Only step back once there is something to step back *from*: with
          // no selection yet all three are equals, and dimming every one of
          // them just makes the whole row look disabled.
          const dimmed = selected !== null && !isSelected && !blocked;

          return (
            <div
              key={id}
              ref={(node) => {
                cardNodes.current[id] = node;
                if (selected === id) surfaceRef.current = node;
              }}
              role="button"
              tabIndex={blocked ? -1 : 0}
              aria-pressed={isSelected}
              onClick={() => !blocked && setSelected(id)}
              onKeyDown={(e) => {
                if (blocked) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(id);
                }
              }}
              className={[
                // `transform` and `opacity` only — both composited, so three
                // cards animating at once stays on the GPU and never reflows
                // the matrix underneath.
                "relative flex flex-col rounded-2xl border p-5 cursor-pointer",
                "transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out",
                "outline-none focus-visible:ring-2 focus-visible:ring-af-primary/50",
                plan.popular
                  ? "border-af-primary/40 bg-af-sage/40"
                  : "border-af-border bg-af-card",
                isSelected
                  ? "scale-[1.03] shadow-af-md border-af-primary/60 opacity-100 z-10"
                  : "shadow-af-sm",
                // The unselected two step back rather than disappear: still
                // readable, clearly not the one in hand.
                dimmed ? "scale-[0.98] opacity-70 hover:opacity-90" : "",
                isCurrent ? "ring-2 ring-af-primary/40" : "",
                blocked ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {/* Badges */}
              <div className="flex items-center justify-between gap-2 min-h-[26px]">
                {plan.popular ? (
                  <Badge tone="primary">
                    <Sparkles className="w-3 h-3" />
                    {t("plans.badge.popular")}
                  </Badge>
                ) : id === "free" ? (
                  <Badge tone="sage">{t("plans.badge.freeForever")}</Badge>
                ) : (
                  <span />
                )}
                {isCurrent && <Badge tone="neutral">{t("plans.badge.current")}</Badge>}
              </div>

              <h3 className="mt-2.5 text-[19px] font-semibold tracking-[-0.02em] text-af-ink">
                {t(plan.nameKey)}
              </h3>
              <p className="mt-0.5 text-[13px] text-af-ink-2 leading-snug">{t(plan.taglineKey)}</p>
              <p className="mt-0.5 text-[11px] text-af-muted leading-snug">{t(plan.audienceKey)}</p>

              {/* Price */}
              <div className="mt-3 flex items-end gap-2">
                <span className="font-mono text-[32px] font-semibold leading-none text-af-ink">
                  {price === 0 ? t("plans.price.free") : rupee(price)}
                </span>
                {price > 0 && (
                  <span className="pb-1 text-sm text-af-ink-2">
                    {cycle === "annual" ? t("plans.price.perYear") : t("plans.price.perMonth")}
                  </span>
                )}
              </div>

              {/*
                The struck-through figure and the saving are computed from the
                two prices, never typed in, so the badge beside a price cannot
                claim a discount the price does not give.
              */}
              {cycle === "annual" && price > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-af-muted line-through">
                    {rupee(annualAtMonthlyRate(plan))}
                  </span>
                  <Badge tone="amber">
                    {saving >= 1
                      ? t("plans.badge.monthsFree", { n: saving })
                      : t("plans.badge.saveRupees", { n: annualSavingRupees(plan) })}
                  </Badge>
                </div>
              )}

              {/* The cap that matters most, stated plainly. */}
              <p className="mt-3 rounded-[12px] bg-af-bg px-3 py-1.5 text-[13px] font-semibold text-af-ink">
                {t("plans.fieldsHeadline", { n: fieldLimit(plan.id) })}
              </p>

              <ul className="mt-3 space-y-1.5 flex-1">
                {onCard.map((f) => (
                  <li key={f.key} className="flex items-start gap-2 text-[13px] text-af-ink-2">
                    <Check className="mt-0.5 w-3.5 h-3.5 shrink-0 text-af-primary" />
                    <span>
                      {t(f.labelKey)}
                      {typeof f.value === "string" && (
                        <span className="text-af-ink font-medium"> · {t(f.value)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {blocked && (
                <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-af-amber/10 px-3 py-2 text-[12px] text-af-amber-ink">
                  <Lock className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                  {blocked}
                </p>
              )}

              <Button
                className="mt-4 w-full"
                variant={plan.popular ? "primary" : "secondary"}
                disabled={isCurrent || !!blocked || busyPlan === id}
                onClick={(e) => {
                  // The card's own click handler would otherwise re-select
                  // underneath this and do nothing useful.
                  e.stopPropagation();
                  setSelected(id);
                  onChoose(id, cycle);
                }}
              >
                {busyPlan === id
                  ? t("plans.cta.saving")
                  : isCurrent
                    ? t("plans.cta.current")
                    : blocked
                      ? t("plans.cta.unavailable")
                      : mode === "onboarding"
                        ? t("plans.cta.choose", { name: t(plan.nameKey) })
                        : t("plans.cta.switch")}
              </Button>
            </div>
          );
        })}
      </div>
      </div>

      {/* Comparison matrix */}
      <div className="mt-6 rounded-2xl border border-af-border bg-af-card overflow-hidden">
        <button
          type="button"
          onClick={() => setMatrixOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-af-bg"
          aria-expanded={matrixOpen}
        >
          <h4 className="text-[15px] font-semibold tracking-[-0.01em] text-af-ink">
            {t("plans.matrix.title")}
          </h4>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-af-muted transition-transform ${matrixOpen ? "rotate-180" : ""}`}
          />
        </button>
        {/*
          Scrolls horizontally on a phone with the feature column pinned. This
          is a mobile-first user base; a matrix that only works on a laptop is
          a matrix most of them never read.
        */}
        {matrixOpen && (
        <div className="overflow-x-auto border-t border-af-border">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-af-border">
                <th className="sticky left-0 z-10 bg-af-card px-5 py-3 text-left text-[12px] font-semibold text-af-ink-2">
                  {t("plans.matrix.feature")}
                </th>
                {PLAN_ORDER.map((id) => (
                  <th
                    key={id}
                    className="px-4 py-3 text-center text-[12px] font-semibold text-af-ink"
                  >
                    {t(PLANS[id].nameKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((key) => (
                <tr key={key} className="border-b border-af-border last:border-0">
                  <td className="sticky left-0 z-10 bg-af-card px-5 py-3 text-[13px] text-af-ink-2">
                    {t(featureOf("elite", key)?.labelKey ?? key)}
                  </td>
                  {PLAN_ORDER.map((id) => {
                    const f = featureOf(id, key);
                    const v = f?.value ?? false;
                    return (
                      <td key={id} className="px-4 py-3 text-center">
                        {v === true ? (
                          <Check className="inline w-4 h-4 text-af-primary" aria-label="included" />
                        ) : v === false ? (
                          <Minus className="inline w-4 h-4 text-af-muted" aria-label="not included" />
                        ) : (
                          <span className="text-[12px] font-medium text-af-ink">{t(v)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-af-muted">{t("plans.disclaimer")}</p>
    </div>
  );
}
