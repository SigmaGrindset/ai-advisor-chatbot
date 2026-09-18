import { describe, expect, it } from "vitest";

import { GREETING, STARTERS } from "./firstRun";

describe("what a first-time visitor is offered", () => {
  it("offers four openings, one of each kind the ticket names", () => {
    expect(STARTERS).toHaveLength(4);
    expect(STARTERS.map((starter) => starter.asks).sort()).toEqual([
      "exchange-rate",
      "planning",
      "visa",
      "weather",
    ]);
  });

  it("asks about the thing each opening says it asks about", () => {
    // The risk is an opening labelled one thing that asks another, which no
    // count of four would catch.
    const about: Record<string, RegExp> = {
      visa: /\bvisa\b/i,
      weather: /\bweather|pack|rain|warm\b/i,
      "exchange-rate": /\beuro|yen|pound|dollar|exchange|rate|worth\b/i,
      planning: /\bplan|days|trip|where|itinerary|weekend\b/i,
    };
    for (const starter of STARTERS) {
      expect(starter.prompt, `the ${starter.asks} opening`).toMatch(about[starter.asks]!);
    }
  });

  it("offers each opening under a label of its own", () => {
    // Four controls that cannot be told apart is the failure worth catching;
    // how long a label may be is a matter of taste, and taste does not belong
    // in an assertion.
    expect(new Set(STARTERS.map((starter) => starter.label)).size).toBe(STARTERS.length);
  });

  it("greets in words, because an empty greeting is no greeting", () => {
    expect(GREETING.trim()).not.toBe("");
  });
});
