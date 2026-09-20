/**
 * What a streamed turn says as it happens: the whole of what the server can
 * say mid-turn, since a turn answers with server-sent events rather than with
 * one reply.
 */

import type { Failure, Message, ProfileFact, TripPlan } from "../api/types";

export type TurnEvent =
  | { type: "traveler_message"; message: Message }
  | { type: "fragment"; text: string }
  | { type: "consulting"; activity: string }
  | { type: "consulted" }
  | { type: "advisor_message"; message: Message }
  | { type: "plan_revised"; plan: TripPlan; changed: string[] }
  // The whole profile rather than the fact that moved: a correction replaces
  // a fact, so a patch would have to say which one.
  | { type: "profile_revised"; profile: ProfileFact[] }
  | { type: "conversation_titled"; title: string }
  // The Message the failed turn left behind, so the question keeps its place
  // and the turn can be run again. Null on the one failure the server never
  // heard about, which the client reports in the same shape.
  | ({ type: "failed"; message: Message | null } & Failure);
