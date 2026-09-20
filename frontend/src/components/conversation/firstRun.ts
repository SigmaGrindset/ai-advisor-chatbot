/**
 * What a traveler who has never been here before is shown.
 *
 * The greeting is interface, not a Message. It is composed here and drawn by
 * the transcript, and it is never sent anywhere and never persisted, so a
 * Conversation contains only things that were actually said in it. The
 * consequence is that it is also never in the advisor's prompt — the advisor
 * has not greeted anyone, the application has.
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
 * Four openings, chosen to show what the advisor can actually do.
 *
 * Three of them are questions no model can answer from memory — entry rules
 * change, a rate is this morning's, and the weather on a week next June is
 * either forecast or measured but never recalled — so the first thing a
 * traveler sees is the advisor going and looking. The fourth is open, because
 * the application is not a lookup service.
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
