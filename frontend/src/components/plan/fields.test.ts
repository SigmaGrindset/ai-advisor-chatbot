import { describe, expect, it } from "vitest";

import type { TripPlan } from "../../api/types";
import { asPatch, valueOf } from "./fields";

function plan(over: Partial<TripPlan> = {}): TripPlan {
  return {
    trip_id: "trip-1",
    destination: "Lisbon",
    starts_on: "2026-05-12",
    ends_on: "2026-05-18",
    party_size: 2,
    budget_amount: 2400,
    budget_currency: "EUR",
    items: [{ id: "item-1", day: 1, part_of_day: "morning", description: "Alfama" }],
    questions: [],
    ...over,
  };
}

describe("reading a field as text", () => {
  it("gives an editor what to open with", () => {
    expect(valueOf(plan(), "destination")).toBe("Lisbon");
    expect(valueOf(plan(), "starts_on")).toBe("2026-05-12");
    expect(valueOf(plan(), "party_size")).toBe("2");
    expect(valueOf(plan(), "budget_amount")).toBe("2400");
    expect(valueOf(plan(), "item-1")).toBe("Alfama");
  });

  it("gives an empty string for a field that holds nothing", () => {
    expect(valueOf(plan({ destination: null }), "destination")).toBe("");
    expect(valueOf(plan({ party_size: null }), "party_size")).toBe("");
  });

  it("gives null for something this plan has not got", () => {
    expect(valueOf(plan(), "item-9")).toBeNull();
  });
});

describe("writing a field back from what was typed", () => {
  it("names only the field that was edited", () => {
    expect(asPatch("destination", " Porto ")).toEqual({ destination: "Porto" });
    expect(asPatch("starts_on", "2026-06-01")).toEqual({ starts_on: "2026-06-01" });
    expect(asPatch("party_size", "3")).toEqual({ party_size: 3 });
  });

  it("empties a field the traveler cleared", () => {
    expect(asPatch("destination", "")).toEqual({ destination: null });
    expect(asPatch("party_size", "   ")).toEqual({ party_size: null });
  });

  it("reads a budget the way it was typed", () => {
    expect(asPatch("budget_amount", "2,400")).toEqual({ budget_amount: 2400 });
    expect(asPatch("budget_amount", "2400.50")).toEqual({ budget_amount: 2400.5 });
    expect(asPatch("budget_currency", "eur")).toEqual({ budget_currency: "EUR" });
  });

  it("patches nothing where what was typed is not a value the field could hold", () => {
    // Not a request to empty anything — leaving a half-typed date or a word
    // in the party size must not wipe what was there.
    expect(asPatch("starts_on", "2026-06")).toEqual({});
    expect(asPatch("party_size", "two")).toEqual({});
    expect(asPatch("party_size", "0")).toEqual({});
    expect(asPatch("party_size", "2.5")).toEqual({});
    expect(asPatch("budget_amount", "-100")).toEqual({});
    expect(asPatch("budget_currency", "euros")).toEqual({});
  });
});
