import { describe, expect, it } from "vitest";

import { settled } from "./announcing";

/** What a screen reader would be given, for a reply that has got this far. */
const readable = (sofar: string) => sofar.slice(0, settled(sofar));

describe("how much of an arriving reply is ready to be read out", () => {
  it("holds back a sentence that is still being written", () => {
    expect(readable("Sintra is worth a day. The pala")).toBe("Sintra is worth a day.");
  });

  it("reads out nothing at all until the first sentence closes", () => {
    expect(readable("Sintra is wor")).toBe("");
  });

  it("takes a question and an exclamation as closing a sentence too", () => {
    expect(readable("Is it worth it? Yes! And th")).toBe("Is it worth it? Yes!");
  });

  it("treats a finished line as finished, since a heading has no full stop", () => {
    expect(readable("Three days in Lisbon\nDay one is")).toBe("Three days in Lisbon");
  });

  it("does not mistake a decimal point for the end of a sentence", () => {
    // "1.08 euros" read as a sentence ending would announce half a figure.
    expect(readable("The rate is 1.08 euros to the pound. It h")).toBe(
      "The rate is 1.08 euros to the pound.",
    );
  });

  it("is everything once the reply has stopped arriving", () => {
    // The tail of a reply that never closed its last sentence is still what
    // the traveler was told, so finishing releases it.
    expect(settled("A whole reply.", true)).toBe("A whole reply.".length);
    expect(settled("An unfinished tail", true)).toBe("An unfinished tail".length);
  });
});
