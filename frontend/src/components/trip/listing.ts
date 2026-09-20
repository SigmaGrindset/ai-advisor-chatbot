/**
 * The traveler's Trips, as the interface keeps them and as the Trips page
 * arranges them.
 *
 * Kept rather than re-read: a Trip is born mid-turn and the plan the turn
 * sends back is the whole of it, so a refetch would say the same thing a
 * round trip later.
 *
 * Gathering is the other half: several Conversations refining one Trip are a
 * group, and one refining none is not a group of one.
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
 * The Trips as they stand once this plan has arrived. An unheard-of Trip has
 * just been started and goes to the front, where the server puts it; one
 * already listed keeps its place rather than moving under the reader.
 */
export function withPlan(trips: TripPlan[], plan: TripPlan): TripPlan[] {
  const known = trips.some((trip) => trip.trip_id === plan.trip_id);
  if (!known) return [plan, ...trips];
  return trips.map((trip) => (trip.trip_id === plan.trip_id ? plan : trip));
}

/**
 * Every Trip with the Conversations refining it, and the Conversations
 * refining none. One naming a Trip this page has not got is listed as
 * unattached rather than dropped: appearing nowhere is worse than appearing
 * under the wrong heading.
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
