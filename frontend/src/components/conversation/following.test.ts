import { describe, expect, it } from "vitest";

import { atBottom } from "./following";

describe("whether the traveler is still at the foot of the transcript", () => {
  it("is true when the transcript is too short to scroll at all", () => {
    expect(atBottom({ scrollTop: 0, scrollHeight: 400, clientHeight: 700 })).toBe(true);
  });

  it("is true at the exact foot", () => {
    expect(atBottom({ scrollTop: 1300, scrollHeight: 2000, clientHeight: 700 })).toBe(true);
  });

  it("is still true a line or so above the foot", () => {
    // A browser reports fractional heights that never quite add up, and a
    // traveler who nudged the wheel once has not left the foot on purpose.
    expect(atBottom({ scrollTop: 1270, scrollHeight: 2000, clientHeight: 700 })).toBe(true);
  });

  it("is false once they have scrolled up to re-read something", () => {
    expect(atBottom({ scrollTop: 900, scrollHeight: 2000, clientHeight: 700 })).toBe(false);
  });
});
