/**
 * What a streamed turn says as it happens.
 *
 * A turn answers with server-sent events rather than with one reply, so the
 * whole of what the server can say mid-turn is this union: the traveler's own
 * Message coming back recorded, the reply arriving a fragment at a time, a
 * Live-data Tool running and finishing, the Trip Plan being patched, the
 * Traveler Profile learning something, the reply once it is a Message, the
 * Conversation being named, and the turn failing.
 */

import type { Failure, Message, ProfileFact, TripPlan } from "../api/types";

export type TurnEvent =
  | { type: "traveler_message"; message: Message }
  | { type: "fragment"; text: string }
  | { type: "consulting"; activity: string }
  | { type: "consulted" }
  | { type: "advisor_message"; message: Message }
  | { type: "plan_revised"; plan: TripPlan; changed: string[] }
  // The whole profile rather than the fact that moved: a correction replaces a
  // fact, so a patch would have to say which one it replaced, and it is a
  // short list read whole.
  | { type: "profile_revised"; profile: ProfileFact[] }
  | { type: "conversation_titled"; title: string }
  // The Message the failed turn left behind — whatever had arrived of the
  // reply, marked with the failure — so that the question keeps its place and
  // the turn can be run again from it. Null on the one failure the server
  // never heard about: a request that could not be made at all, which this
  // client reports in the same words so that everything that shows a turn has
  // one shape to read.
  | ({ type: "failed"; message: Message | null } & Failure);
