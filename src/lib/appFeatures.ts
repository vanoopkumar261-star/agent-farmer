/**
 * What this app can actually do, written for the assistant to read.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 *
 * A farmer asked the voice assistant: "if I want to check the disease detection
 * of the soybean, what steps should I follow?" It answered — walk the field,
 * bag a few sick seedlings, post them to your nearest Krishi Vigyan Kendra lab.
 *
 * Sound agronomy. Completely wrong answer. This app has a disease scanner that
 * diagnoses a leaf from a photo in about ten seconds, and the assistant sent
 * the farmer to the postal service instead, because nothing in its prompt had
 * ever told it the scanner exists.
 *
 * The system prompt gave it the farmer's crops, soil, weather and tasks — a lot
 * of detail about the farm, and not one word about the product it is embedded
 * in. So it answered every "how do I…" from general agronomy, which is the one
 * place the answer was never going to be.
 *
 * ── Why a table and not a paragraph in the prompt ────────────────────────────
 *
 * This list has to stay true as the app changes, and a feature described in
 * three places drifts in two of them. Everything the assistant says about the
 * product is generated from here: the route it names, what the page does, and
 * the words a farmer is likely to use when they want it. A new page gets one
 * entry and the assistant knows about it everywhere.
 *
 * ── Keep it short ────────────────────────────────────────────────────────────
 *
 * This block goes into every chat request, and the Groq free tier binds on
 * tokens per minute. `describe` is one line per feature for that reason. Say
 * what the page does and what the farmer calls it; do not sell it.
 */

export type AppFeature = {
  /** Route the farmer navigates to. */
  path: string;
  /** The page's name in the UI (English — the model renders it in context). */
  name: string;
  /** What it does, in one line. */
  does: string;
  /** How the farmer gets a result, when it is not obvious from the name. */
  steps?: string;
};

export const APP_FEATURES: AppFeature[] = [
  {
    path: "/dashboard/disease",
    name: "Crop Health (disease scanner)",
    does: "diagnoses plant disease from a photo of a leaf, and gives an organic and a chemical treatment plan",
    steps: "take or upload a clear close-up photo of the affected leaf, then tap Analyse",
  },
  {
    path: "/dashboard/soil",
    name: "Soil pH",
    does: "reads soil pH from a photo of a handheld pH meter, logs it, and says how to correct the soil for the crop in the ground",
    steps: "photograph the meter display, confirm the reading it detects, and save",
  },
  {
    path: "/dashboard/irrigation",
    name: "Smart Irrigation",
    does: "works out how much water each farm needs today, when to water next, and how much of it the forecast rain will cover",
  },
  {
    path: "/dashboard/market",
    name: "Market",
    does: "shows today's mandi prices for the farmer's crops, compares live prices across mandis, and plans transport",
  },
  {
    path: "/dashboard/crops",
    name: "My Crops",
    does: "every registered farm and crop, its growth stage, days to harvest and expected yield",
  },
  {
    path: "/dashboard/schemes",
    name: "Schemes",
    does: "matches government schemes and subsidies to this farmer and shows how to apply",
  },
  {
    path: "/dashboard/expenses",
    name: "Expenses",
    does: "records farm spending and income and shows profit per crop",
  },
  {
    path: "/dashboard/inputs",
    name: "Input Prices",
    does: "current prices for seed, fertiliser and pesticide",
  },
  {
    path: "/dashboard/store-locator",
    name: "Store Locator",
    does: "finds agri-input shops nearby",
  },
  {
    path: "/dashboard/news",
    name: "Farm News",
    does: "farming headlines picked for this farmer's crops and state",
  },
  {
    path: "/dashboard",
    name: "Dashboard (home)",
    does: "farm health score, today's weather, live sensor readings, today's tasks and alerts",
  },
  {
    path: "/jaivik-sathi/library",
    name: "Library",
    does: "organic-farming handbooks and guides to read",
  },
  {
    path: "/dashboard/settings",
    name: "Settings",
    does: "language, theme, plan and farm details",
  },
];

/**
 * The feature list as a prompt block.
 *
 * Deliberately phrased as a capability the assistant HAS rather than a list of
 * links, because the failure mode being fixed is the assistant not realising
 * these are its own hands.
 */
export function buildFeatureBlock(): string {
  const lines = APP_FEATURES.map(
    (f) => `- ${f.name} (${f.path}) — ${f.does}${f.steps ? `. To use it: ${f.steps}` : ""}`
  ).join("\n");

  return `
THIS APP'S OWN FEATURES — you are built into the Agent Farmer app, and these are the tools the farmer already has:
${lines}

USING THEM IN YOUR ANSWERS:
- When the farmer asks how to do something this app already does, your FIRST sentence names the page and what to tap there. Only then add any field advice.
- This matters most for disease. If they ask about checking, identifying or diagnosing a crop disease, tell them to open Crop Health and photograph the leaf. Do NOT tell them to send samples to a lab or visit a Krishi Vigyan Kendra as the first step — the app diagnoses it in seconds. Mention an agriculture officer or KVK only to confirm a diagnosis before spending money on chemicals, which is the honest caveat, never the starting point.
- Name the page as the farmer sees it, in their language, and give the path in brackets once, e.g. "Crop Health (/dashboard/disease)".
- Describe what to DO in plain words — "take a photo of the leaf and start the scan". Do not quote exact button text in quotation marks: the interface runs in nine languages and the farmer will not see the English label you invented.
- Never invent a page, a button or a feature that is not in the list above. If the app cannot do what they are asking, say so plainly and give the field advice instead.
- Keep it to the steps that matter. Two or three is almost always enough.`;
}
