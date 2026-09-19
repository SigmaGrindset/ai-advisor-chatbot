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

import type { Message, ProfileFact, TripPlan } from "../api/types";

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
  | { type: "failed"; detail: string };
