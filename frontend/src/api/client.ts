/**
 * The application's own API, and the reader for its streamed turns.
 *
 * A turn is a POST that answers with server-sent events, so it is read with a
 * stream reader rather than an EventSource — EventSource can only GET. Lines
 * that are not `data:` lines, including keep-alive comments, are dropped.
 */

import type { TurnEvent } from "../stream/events";
import type {
  AdvisorInstructions,
  ConversationRead,
  ConversationSummary,
  PartOfDay,
  PlanPatch,
  ProfileFact,
  TripPlan,
} from "./types";

export async function listConversations(): Promise<ConversationSummary[]> {
  return await expected<ConversationSummary[]>(await fetch("/api/conversations"));
}

export async function startConversation(): Promise<ConversationSummary> {
  return await expected<ConversationSummary>(
    await fetch("/api/conversations", { method: "POST" }),
  );
}

export async function readConversation(id: string): Promise<ConversationRead> {
  return await expected<ConversationRead>(await fetch(`/api/conversations/${id}`));
}

/** Every Trip the traveler is planning, the most recently started first. */
export async function listTrips(): Promise<TripPlan[]> {
  return await expected<TripPlan[]>(await fetch("/api/trips"));
}

/**
 * Move a Conversation to a Trip, or take it off the one it is on.
 *
 * It answers with the plan the Conversation refines from here — null when it
 * refines none — because that is what the pane beside it shows next.
 */
export async function attachConversation(
  conversationId: string,
  tripId: string | null,
): Promise<TripPlan | null> {
  return await expected<TripPlan | null>(
    await fetch(`/api/conversations/${conversationId}/trip`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trip_id: tripId }),
    }),
  );
}

/**
 * Changing the Trip Plan by hand.
 *
 * Every one of these answers with the whole plan, because every one of them
 * changed it and the pane is showing it — one round trip rather than a write
 * and a read. What they *write* is only what was named: a field left out of a
 * patch is not touched, and a field named as null is one the traveler emptied.
 */

export async function changePlan(tripId: string, patch: PlanPatch): Promise<TripPlan> {
  return await sent(`/api/trips/${tripId}`, "PATCH", patch);
}

export async function addItineraryItem(
  tripId: string,
  adding: { day: number; part_of_day?: PartOfDay | null; description: string },
): Promise<TripPlan> {
  return await sent(`/api/trips/${tripId}/itinerary`, "POST", adding);
}

/** The one thing an Itinerary Item is edited in place for. */
export async function changeItineraryItem(
  tripId: string,
  itemId: string,
  description: string,
): Promise<TripPlan> {
  return await sent(`/api/trips/${tripId}/itinerary/${itemId}`, "PATCH", { description });
}

export async function removeItineraryItem(tripId: string, itemId: string): Promise<TripPlan> {
  return await sent(`/api/trips/${tripId}/itinerary/${itemId}`, "DELETE");
}

export async function settleOpenQuestion(
  tripId: string,
  questionId: string,
): Promise<TripPlan> {
  return await sent(`/api/trips/${tripId}/questions/${questionId}`, "DELETE");
}

async function sent(url: string, method: string, body?: unknown): Promise<TripPlan> {
  return await expected<TripPlan>(
    await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }),
  );
}

export async function deleteConversation(id: string): Promise<void> {
  refused(await fetch(`/api/conversations/${id}`, { method: "DELETE" }));
}

/**
 * The Traveler Profile, and the two ways it goes away.
 *
 * Deleting one fact answers with the profile as it stands afterwards, the same
 * way a change to the Trip Plan answers with the whole plan: the pane is
 * showing the list that was just deleted from.
 */

export async function readProfile(): Promise<ProfileFact[]> {
  return await expected<ProfileFact[]>(await fetch("/api/traveler/profile"));
}

export async function forgetProfileFact(factId: string): Promise<ProfileFact[]> {
  return await expected<ProfileFact[]>(
    await fetch(`/api/traveler/profile/${factId}`, { method: "DELETE" }),
  );
}

/** Every Conversation, every Trip and the whole profile, gone. */
export async function clearEverything(): Promise<void> {
  refused(await fetch("/api/traveler/everything", { method: "DELETE" }));
}

/**
 * The Advisor Instructions, and the two ways they change.
 *
 * Each answers with the instructions *and* the whole prompt composed around
 * them, the same way a change to the Trip Plan answers with the whole plan:
 * the page shows both, and what has just changed is what it is showing.
 *
 * The Conversation is named so that the Trip Plan composed into the preview is
 * the plan of the Conversation the traveler came from — what they are shown is
 * then what their very next message actually sends. Null when they are in no
 * Conversation yet, which composes the way a turn of one refining no Trip does.
 */

export async function readInstructions(
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await fetch(`/api/advisor/instructions${asking(conversationId)}`),
  );
}

export async function saveInstructions(
  instructions: string,
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await fetch(`/api/advisor/instructions${asking(conversationId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions }),
    }),
  );
}

/** Put the shipped Advisor Instructions back, as a version of their own. */
export async function restoreInstructions(
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await fetch(`/api/advisor/instructions${asking(conversationId)}`, { method: "DELETE" }),
  );
}

function asking(conversationId: string | null): string {
  return conversationId === null ? "" : `?conversation_id=${conversationId}`;
}

/**
 * Say something to the advisor, and yield what comes back as it arrives.
 *
 * Aborting the signal drops the connection, which is the only way to stop a
 * reply: there is no second request that calls the first one off. The server
 * sees the disconnect and abandons the turn.
 */
export async function* say(
  conversationId: string,
  content: string,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok || !response.body) {
    yield { type: "failed", detail: await refusal(response) };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    // Events are separated by a blank line, and an event may still be arriving
    // when a read returns, so only whole ones are taken off the buffer.
    let boundary = buffered.indexOf("\n\n");
    while (boundary !== -1) {
      const event = buffered.slice(0, boundary);
      buffered = buffered.slice(boundary + 2);
      for (const line of event.split("\n")) {
        if (line.startsWith("data: ")) {
          yield JSON.parse(line.slice("data: ".length)) as TurnEvent;
        }
      }
      boundary = buffered.indexOf("\n\n");
    }
  }
}

async function expected<T>(response: Response): Promise<T> {
  refused(response);
  return (await response.json()) as T;
}

/**
 * Throws when the API said no. What the traveler is told is the interface's to
 * decide, so what is thrown here is for whoever is reading a console.
 */
function refused(response: Response): void {
  if (!response.ok) throw new Error(`${response.status} from ${response.url}`);
}

async function refusal(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // A response that is not the API's own JSON says nothing useful.
  }
  return "The advisor could not answer.";
}
