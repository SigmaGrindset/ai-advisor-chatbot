import { describe, expect, it } from "vitest";

import type { TripPlan } from "../../api/types";
import { tripName } from "./naming";

function plan(over: Partial<TripPlan> = {}): TripPlan {
  return {
    trip_id: "trip-1",
    destination: null,
    starts_on: null,
    ends_on: null,
    party_size: null,
    budget_amount: null,
    budget_currency: null,
    items: [],
    questions: [],
    ...over,
  };
}

describe("what a Trip is called", () => {
  it("is where it is going", () => {
    expect(tripName(plan({ destination: "Lisbon" }))).toBe("Lisbon");
  });

  it("is when it is, while nowhere has been decided", () => {
    expect(tripName(plan({ starts_on: "2026-05-12", ends_on: "2026-05-18" }))).toBe(
      "12 May – 18 May 2026",
    );
  });

  it("says what is missing rather than inventing a name", () => {
    expect(tripName(plan())).toBe("Destination not decided");
  });

  it("prefers where over when, once there is a where", () => {
    expect(tripName(plan({ destination: "Lisbon", starts_on: "2026-05-12" }))).toBe("Lisbon");
  });
});
