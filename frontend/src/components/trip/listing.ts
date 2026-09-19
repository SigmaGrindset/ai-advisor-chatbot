/**
 * The traveler's Trips, as the interface keeps them and as the Trips page
 * arranges them.
 *
 * The list arrives once and is then kept rather than re-read, because a Trip
 * is born mid-turn: the first thing the advisor records about a journey
 * starts one, and the plan it sends back is the whole of what the new Trip
 * is. A refetch would say the same thing a round trip later, and the chip
 * beside the Conversation would appear a moment after the plan it belongs to.
 *
 * Gathering is the other half. Several Conversations refining one Trip are a
 * group, and a Conversation refining none is not a group of one — it is a
 * Conversation the advisor has not put anywhere yet, and saying so is the
 * point.
 */

import type { ConversationSummary, TripPlan } from "../../api/types";

/** One Trip, with the Conversations refining it. */
export type TripGathering = {
  plan: TripPlan;
  /** In the order they are listed, so the most recently used is first. */
  conversations: ConversationSummary[];
};

export type Gathering = {
  trips: TripGathering[];
  /** The Conversations on no Trip, which is where every one of them starts. */
  unattached: ConversationSummary[];
};

/**
 * The Trips as they stand once this plan has arrived.
 *
 * A Trip nobody had heard of is a Trip that has just been started, and goes
 * to the front, where the server also puts it. One already listed keeps its
 * place: a plan moving a Trip up the page while the traveler is reading it
 * would be a change to something they did not change.
 */
export function withPlan(trips: TripPlan[], plan: TripPlan): TripPlan[] {
  const known = trips.some((trip) => trip.trip_id === plan.trip_id);
  if (!known) return [plan, ...trips];
  return trips.map((trip) => (trip.trip_id === plan.trip_id ? plan : trip));
}

/**
 * Every Trip with the Conversations refining it, and the Conversations
 * refining none.
 *
 * A Conversation naming a Trip this page has not got is listed as unattached
 * rather than dropped: a Conversation that appears nowhere is one the
 * traveler cannot get back to, which is worse than one filed under the wrong
 * heading.
 */
export function gathered(
  trips: TripPlan[],
  conversations: ConversationSummary[],
): Gathering {
  const known = new Set(trips.map((trip) => trip.trip_id));
  return {
    trips: trips.map((plan) => ({
      plan,
      conversations: conversations.filter((each) => each.trip_id === plan.trip_id),
    })),
    unattached: conversations.filter(
      (each) => each.trip_id === null || !known.has(each.trip_id),
    ),
  };
}
