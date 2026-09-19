import { describe, expect, it } from "vitest";

import type { ProfileFact, ProfileSubject } from "../../api/types";
import { factSaid, inReadingOrder } from "./listing";

function fact(subject: ProfileSubject, detail: string): ProfileFact {
  return { id: `${subject}-${detail}`, subject, detail };
}

describe("the profile as it is read", () => {
  it("puts the three the traveler has one of in their own order, whatever was learned first", () => {
    const read = inReadingOrder([
      fact("companions", "her partner"),
      fact("note", "vegetarian"),
      fact("nationality", "Croatian"),
      fact("home_city", "Zagreb"),
    ]);

    expect(read.map((each) => each.subject)).toEqual([
      "nationality",
      "home_city",
      "companions",
      "note",
    ]);
  });

  it("keeps the notes in the order they were learned", () => {
    const read = inReadingOrder([
      fact("note", "vegetarian"),
      fact("nationality", "Croatian"),
      fact("note", "will not fly overnight"),
    ]);

    expect(read.map((each) => each.detail)).toEqual([
      "Croatian",
      "vegetarian",
      "will not fly overnight",
    ]);
  });

  it("loses nothing on the way", () => {
    const facts = [fact("note", "vegetarian"), fact("home_city", "Zagreb")];

    expect(inReadingOrder(facts)).toHaveLength(facts.length);
  });
});

describe("one fact said in a line", () => {
  it("names what it is about, so a control deleting it says which one", () => {
    expect(factSaid(fact("nationality", "Croatian"))).toBe("Nationality: Croatian");
    expect(factSaid(fact("companions", "her partner"))).toBe("Travels with: her partner");
  });
});
