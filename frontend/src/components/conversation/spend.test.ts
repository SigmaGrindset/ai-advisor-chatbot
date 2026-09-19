import { describe, expect, it } from "vitest";

import { spent } from "./spend";

describe("what a turn cost, written out", () => {
  it("keeps a fraction of a cent legible", () => {
    expect(spent(0.0000362)).toBe("$0.000036");
  });

  it("keeps two turns that cost nearly the same apart", () => {
    expect(spent(0.015548)).toBe("$0.015548");
    expect(spent(0.0241)).toBe("$0.0241");
  });

  it("writes a round amount the way a price is written", () => {
    expect(spent(1.5)).toBe("$1.50");
    expect(spent(0.42)).toBe("$0.42");
  });

  it("says a free turn was free rather than showing six zeroes", () => {
    expect(spent(0)).toBe("$0.00");
  });

  it("never rounds a turn that cost something down to nothing", () => {
    expect(spent(0.0000004)).toBe("under $0.000001");
  });
});
