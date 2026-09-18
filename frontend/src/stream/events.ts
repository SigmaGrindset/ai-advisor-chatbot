/**
 * What a streamed turn says as it happens.
 *
 * A turn answers with server-sent events rather than with one reply, so the
 * whole of what the server can say mid-turn is this union: the traveler's own
 * Message coming back recorded, the reply arriving a fragment at a time, the
 * reply once it is a Message, the Conversation being named, and the turn
 * failing.
 */

import type { Message } from "../api/types";

export type TurnEvent =
  | { type: "traveler_message"; message: Message }
  | { type: "fragment"; text: string }
  | { type: "advisor_message"; message: Message }
  | { type: "conversation_titled"; title: string }
  | { type: "failed"; detail: string };
