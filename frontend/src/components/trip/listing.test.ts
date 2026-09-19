import { describe, expect, it } from "vitest";

import type { ConversationSummary, TripPlan } from "../../api/types";
import { gathered, withPlan } from "./listing";

function plan(tripId: string, over: Partial<TripPlan> = {}): TripPlan {
  return {
    trip_id: tripId,
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

function conversation(id: string, tripId: string | null): ConversationSummary {
  return { id, title: id, last_activity_at: "2026-04-01T10:00:00Z", trip_id: tripId };
}

describe("a plan arriving", () => {
  it("starts a Trip the list had not heard of, at the front", () => {
    const listed = withPlan([plan("lisbon")], plan("oslo"));

    expect(listed.map((trip) => trip.trip_id)).toEqual(["oslo", "lisbon"]);
  });

  it("revises a Trip already listed without moving it", () => {
    const listed = withPlan(
      [plan("oslo"), plan("lisbon")],
      plan("lisbon", { destination: "Lisbon" }),
    );

    expect(listed.map((trip) => trip.trip_id)).toEqual(["oslo", "lisbon"]);
    expect(listed[1]?.destination).toBe("Lisbon");
  });
});

describe("the Conversations gathered under their Trips", () => {
  it("puts several Conversations about one journey together", () => {
    const { trips } = gathered(
      [plan("lisbon")],
      [conversation("a", "lisbon"), conversation("b", null), conversation("c", "lisbon")],
    );

    expect(trips).toHaveLength(1);
    expect(trips[0]?.conversations.map((each) => each.id)).toEqual(["a", "c"]);
  });

  it("lists a Trip nothing is refining, because it is still a Trip", () => {
    const { trips } = gathered([plan("lisbon")], []);

    expect(trips[0]?.conversations).toEqual([]);
  });

  it("shows one on no Trip as such rather than filing it under a Trip", () => {
    const { unattached } = gathered(
      [plan("lisbon")],
      [conversation("a", "lisbon"), conversation("b", null)],
    );

    expect(unattached.map((each) => each.id)).toEqual(["b"]);
  });

  it("keeps one whose Trip it has never heard of rather than losing it", () => {
    const { unattached } = gathered([plan("lisbon")], [conversation("a", "oslo")]);

    expect(unattached.map((each) => each.id)).toEqual(["a"]);
  });
});
