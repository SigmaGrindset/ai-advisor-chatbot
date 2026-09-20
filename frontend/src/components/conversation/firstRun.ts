/**
 * What a traveler who has never been here before is shown.
 *
 * The greeting is interface, not a Message: never sent and never persisted,
 * so a Conversation holds only what was actually said in it and the advisor's
 * prompt never carries a greeting the advisor did not give.
 */

export const GREETING =
  "I plan trips. Ask about anywhere you are going and I will look things up rather than guess.";

/** The kinds of opening the first run offers, one each. */
export type Opening = "visa" | "weather" | "exchange-rate" | "planning";

export type Starter = {
  asks: Opening;
  /** What the control says, short enough to read at a glance. */
  label: string;
  /** What lands in the composer — a whole question, ready to edit or send. */
  prompt: string;
};

/**
 * Four openings, chosen to show what the advisor can actually do. Three are
 * questions no model can answer from memory, so the first thing a traveler
 * sees is the advisor going and looking; the fourth is open, because this is
 * not a lookup service.
 */
export const STARTERS: readonly Starter[] = [
  {
    asks: "visa",
    label: "Entry requirements",
    prompt: "I hold a British passport. Do I need a visa to visit Japan for two weeks?",
  },
  {
    asks: "weather",
    label: "What to pack",
    prompt: "I have a week in Lisbon next June. What will the weather be like, and what should I pack?",
  },
  {
    asks: "exchange-rate",
    label: "What my money is worth",
    prompt: "How many euros is 500 pounds worth at today's exchange rate?",
  },
  {
    asks: "planning",
    label: "Plan a few days",
    prompt: "I have four days in northern Italy in October. Where should I go?",
  },
];
