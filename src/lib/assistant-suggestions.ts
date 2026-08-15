import type { FarmWithCrop } from "./dashboard";

/**
 * Builds the starter questions shown when the assistant opens with no history.
 *
 * These are *UI affordances only* — clicking one sends it through the same
 * /api/chat call as typing it by hand. Nothing here reaches the model directly,
 * and the real farm context still comes from buildAssistantContext() on the
 * server. This only reuses farm data the dashboard has already loaded so the
 * wording names the farmer's actual crop instead of saying "my crop".
 */
export function assistantSuggestions(farms: FarmWithCrop[]): string[] {
  const cropped = farms.filter((f) => f.crop);
  const crop = cropped[0]?.crop?.chosen_crop;

  // No farm or no crop yet — steer them toward getting set up.
  if (!crop) {
    return [
      "How is my farm doing?",
      "Which crop suits my soil best?",
      "What does this week's weather mean for my farm?",
      "How do I get started with Agent Farmer?",
    ];
  }

  const out = [
    `How is my ${crop} doing?`,
    "When should I irrigate?",
    "What does this week's weather mean for my crop?",
  ];

  // Multiple cropped farms → comparing them is a genuinely useful fourth prompt.
  out.push(
    cropped.length > 1
      ? "Which of my farms needs attention first?"
      : `How can I improve my ${crop} yield?`
  );

  return out;
}
