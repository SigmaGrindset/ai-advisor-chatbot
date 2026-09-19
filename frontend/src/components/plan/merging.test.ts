import { describe, expect, it } from "vitest";

import type { TripPlan } from "../../api/types";
import { merged } from "./merging";

const TRIP = "trip-1";

function plan(over: Partial<TripPlan> = {}): TripPlan {
  return {
    trip_id: TRIP,
    destination: "Lisbon",
    starts_on: "2026-05-12",
    ends_on: "2026-05-18",
    party_size: 2,
    budget_amount: 2400,
    budget_currency: "EUR",
    items: [{ id: "item-1", day: 1, part_of_day: "morning", description: "Alfama" }],
    questions: [{ id: "question-1", question: "Which airport?" }],
    ...over,
  };
}

describe("a patch arriving while the traveler is editing", () => {
  it("leaves the field they are in and applies everywhere else", () => {
    const showing = plan();
    const incoming = plan({ destination: "Porto", party_size: 4 });

    const { plan: after } = merged(showing, incoming, ["destination", "party_size"], "destination");

    expect(after.destination).toBe("Lisbon");
    expect(after.party_size).toBe(4);
  });

  it("keeps what the advisor wanted as a suggestion rather than dropping it", () => {
    const { suggestions } = merged(
      plan(),
      plan({ destination: "Porto" }),
      ["destination"],
      "destination",
    );

    expect(suggestions).toEqual([{ field: "destination", value: "Porto" }]);
  });

  it("says nothing when the patch was about a different field", () => {
    const { plan: after, suggestions } = merged(
      plan(),
      plan({ party_size: 4 }),
      ["party_size"],
      "destination",
    );

    expect(suggestions).toEqual([]);
    expect(after.party_size).toBe(4);
  });

  it("says nothing when the advisor wrote what they were already typing towards", () => {
    // The field is named as changed, but it now holds what is on screen — the
    // traveler has nothing to be told and nothing to choose between.
    const { suggestions } = merged(plan(), plan(), ["destination"], "destination");

    expect(suggestions).toEqual([]);
  });

  it("protects an Itinerary Item's description the same way", () => {
    const showing = plan();
    const incoming = plan({
      items: [
        { id: "item-1", day: 1, part_of_day: "morning", description: "Alfama and tram 28" },
        { id: "item-2", day: 2, part_of_day: null, description: "Belém" },
      ],
    });

    const { plan: after, suggestions } = merged(showing, incoming, ["item-1"], "item-1");

    expect(after.items.map((item) => item.description)).toEqual(["Alfama", "Belém"]);
    expect(suggestions).toEqual([{ field: "item-1", value: "Alfama and tram 28" }]);
  });

  it("gives way when the item being edited is no longer on the plan", () => {
    const { plan: after, suggestions } = merged(plan(), plan({ items: [] }), [], "item-1");

    expect(after.items).toEqual([]);
    expect(suggestions).toEqual([]);
  });

  it("gives way when the Conversation has been joined to another Trip", () => {
    const incoming = plan({ trip_id: "trip-2", destination: "Porto" });

    const { plan: after } = merged(plan(), incoming, [], "destination");

    expect(after.destination).toBe("Porto");
  });
});

describe("a patch arriving while nothing is being edited", () => {
  it("is taken whole", () => {
    const incoming = plan({ destination: "Porto", items: [] });

    expect(merged(plan(), incoming, ["destination"], null)).toEqual({
      plan: incoming,
      suggestions: [],
    });
  });

  it("is taken whole when there was no plan on screen at all", () => {
    const incoming = plan();

    expect(merged(null, incoming, ["destination"], null).plan).toBe(incoming);
  });
});
