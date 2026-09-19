/**
 * The application's own API, and the reader for its streamed turns.
 *
 * A turn is a POST that answers with server-sent events, so it is read with a
 * stream reader rather than an EventSource — EventSource can only GET. Lines
 * that are not `data:` lines, including keep-alive comments, are dropped.
 */

import type { TurnEvent } from "../stream/events";
import type {
  ConversationRead,
  ConversationSummary,
  PartOfDay,
  PlanPatch,
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
