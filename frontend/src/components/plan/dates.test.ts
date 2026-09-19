import { describe, expect, it } from "vitest";

import { nights, showDate, showDay, showRange } from "./dates";

describe("showing a Trip's dates", () => {
  it("says the year once when both ends share it", () => {
    expect(showRange("2026-05-12", "2026-05-18")).toBe("12 May – 18 May 2026");
  });

  it("says it twice when they do not", () => {
    expect(showRange("2026-12-28", "2027-01-04")).toBe("28 December 2026 – 4 January 2027");
  });

  it("says what is decided when only one end is", () => {
    expect(showRange("2026-05-12", null)).toBe("From 12 May 2026");
    expect(showRange(null, "2026-05-18")).toBe("Back on 18 May 2026");
    expect(showRange(null, null)).toBeNull();
  });

  it("reads a calendar day as that day, not as an instant", () => {
    // The failure this guards is a date read in a timezone behind Greenwich
    // and shown as the evening before — the traveler being told a day they
    // did not type.
    expect(showDate("2026-01-01")).toBe("1 January 2026");
  });

  it("counts both ends of the trip", () => {
    expect(nights("2026-05-12", "2026-05-18")).toBe(7);
    expect(nights("2026-05-12", "2026-05-12")).toBe(1);
    expect(nights("2026-05-18", "2026-05-12")).toBeNull();
    expect(nights("2026-05-12", null)).toBeNull();
  });
});

describe("showing which day of the trip an Itinerary Item is on", () => {
  it("counts forward from the first day, which is day 1", () => {
    expect(showDay(1, "2026-05-12")).toBe("Tue 12 May");
    expect(showDay(3, "2026-05-12")).toBe("Thu 14 May");
  });

  it("crosses a month and a year without arithmetic of its own", () => {
    expect(showDay(5, "2026-12-30")).toBe("Sun 3 Jan");
  });

  it("says nothing while the trip has no start date to count from", () => {
    expect(showDay(2, null)).toBeNull();
  });
});
