/**
 * What the farmer is currently looking at, in one line, for the agent gateway.
 *
 * /api/agent/turn already accepts a `screenSummary` and splices it into its
 * system prompt ("The farmer is currently looking at: …"). Nothing on the web
 * ever sent one, so the voice assistant answered every question with no idea
 * which page the question was being asked from. "What does this mean?" on the
 * irrigation page and on the market page are different questions.
 *
 * The mobile app solves this with a registry each screen writes into
 * (`registerScreenDescriber`), because an Expo screen can describe its own
 * live state. Here a static route map is the better fit: Next.js pages are
 * server components that have already rendered by the time the voice modal
 * opens, so there is no client-side state for them to publish, and a route is
 * a reliable thing to read from `usePathname()`.
 *
 * Kept to one short clause per route. It is prepended to every agent turn, and
 * the gateway truncates it at 200 characters anyway.
 */

const SCREENS: { match: RegExp; summary: string }[] = [
  { match: /^\/dashboard\/disease/, summary: "the crop disease scanner, where a leaf photo is diagnosed" },
  { match: /^\/dashboard\/soil/, summary: "the soil pH page, where a meter reading is photographed and logged" },
  { match: /^\/dashboard\/irrigation/, summary: "the irrigation plan, showing how much water each farm needs today" },
  { match: /^\/dashboard\/market/, summary: "the market page, showing today's mandi prices and transport costs" },
  { match: /^\/dashboard\/crops/, summary: "the crops page, listing each farm, its crop and its growth stage" },
  { match: /^\/dashboard\/expenses/, summary: "the expenses page, where farm spending and income are recorded" },
  { match: /^\/dashboard\/schemes/, summary: "the government schemes page" },
  { match: /^\/dashboard\/inputs/, summary: "the input prices page, showing seed, fertiliser and pesticide rates" },
  { match: /^\/dashboard\/store-locator/, summary: "the store locator, showing nearby agri-input shops" },
  { match: /^\/dashboard\/news/, summary: "the farm news page" },
  { match: /^\/dashboard\/settings/, summary: "the settings page" },
  { match: /^\/dashboard\/assistant/, summary: "the AI assistant chat" },
  { match: /^\/jaivik-sathi\/library/, summary: "the handbook library" },
  { match: /^\/dashboard$/, summary: "the dashboard home, with farm health, weather, sensors, tasks and alerts" },
];

export function describeScreen(pathname: string | null | undefined): string {
  if (!pathname) return "";
  return SCREENS.find((s) => s.match.test(pathname))?.summary ?? "";
}
