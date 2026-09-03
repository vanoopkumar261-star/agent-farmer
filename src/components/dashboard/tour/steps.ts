/**
 * The tutorial script.
 *
 * Data only — the engine in DashboardTour.tsx reads this and knows nothing
 * about what any step says, so rewriting copy never means touching behaviour.
 *
 * `anchor` is a `data-tour` attribute value on a real element. A step whose
 * anchor is absent from the page is dropped before the tour starts, which is
 * what lets the same script work on a phone (no sidebar), for a farmer with no
 * farms (no stat tiles), and when the weather fetch failed (no weather card) —
 * without any of those cases being special-cased here.
 *
 * `anchor: null` is a centred card with no highlight, for the opening and
 * closing steps.
 *
 * Copy is written as what the thing does for the farmer, not what it is called.
 * "Spot disease before it spreads" teaches; "Disease Detection module" does not.
 */
export type TourStep = {
  id: string;
  /** `data-tour` value to highlight, or null for a centred card. */
  anchor: string | null;
  titleKey: string;
  bodyKey: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    anchor: null,
    titleKey: "tour.welcome.title",
    bodyKey: "tour.welcome.body",
  },
  {
    id: "quick-actions",
    anchor: "quick-actions",
    titleKey: "tour.quickActions.title",
    bodyKey: "tour.quickActions.body",
  },
  {
    id: "stats",
    anchor: "stats",
    titleKey: "tour.stats.title",
    bodyKey: "tour.stats.body",
  },
  {
    id: "weather",
    anchor: "weather",
    titleKey: "tour.weather.title",
    bodyKey: "tour.weather.body",
  },
  {
    id: "tasks",
    anchor: "tasks",
    titleKey: "tour.tasks.title",
    bodyKey: "tour.tasks.body",
  },
  {
    // The emergency check is the least discoverable feature in the app and the
    // one that matters most, so it gets its own beat rather than a mention.
    id: "alerts",
    anchor: "alerts",
    titleKey: "tour.alerts.title",
    bodyKey: "tour.alerts.body",
  },
  {
    id: "assistant",
    anchor: "assistant",
    titleKey: "tour.assistant.title",
    bodyKey: "tour.assistant.body",
  },
  {
    // Dropped automatically below 1024px, where the sidebar is `hidden lg:flex`.
    id: "sidebar",
    anchor: "sidebar",
    titleKey: "tour.sidebar.title",
    bodyKey: "tour.sidebar.body",
  },
  {
    id: "done",
    anchor: null,
    titleKey: "tour.done.title",
    bodyKey: "tour.done.body",
  },
];
