import { describe, expect, it } from "vitest";

import { questionPrompt } from "./questionPrompt";

describe("the message an Open Question composes", () => {
  it("asks about the question the plan is holding", () => {
    expect(questionPrompt("Which airport to fly into?")).toBe(
      "Let's settle this: Which airport to fly into?",
    );
  });

  it("makes a question of one the advisor left unpunctuated", () => {
    expect(questionPrompt("Which airport to fly into")).toBe(
      "Let's settle this: Which airport to fly into?",
    );
  });

  it("leaves other punctuation as it was written", () => {
    expect(questionPrompt("Decide between Porto and Lisbon.")).toBe(
      "Let's settle this: Decide between Porto and Lisbon.",
    );
  });

  it("has nothing to compose from nothing", () => {
    expect(questionPrompt("   ")).toBe("");
  });
});
