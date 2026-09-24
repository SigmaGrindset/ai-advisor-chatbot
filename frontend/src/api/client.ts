/**
 * The application's own API, and the reader for its streamed turns.
 *
 * A turn is a POST that answers with server-sent events, so it is read with a
 * stream reader rather than an EventSource — EventSource can only GET. Lines
 * that are not `data:` lines, including keep-alive comments, are dropped.
 *
 * Every request goes to `API_BASE_URL`, as this browser's Traveler: see
 * `request`.
 */

import type { TurnEvent } from "../stream/events";
import type {
  AdvisorInstructions,
  ConversationRead,
  ConversationSummary,
  Failure,
  PartOfDay,
  PlanPatch,
  ProfileFact,
  TripPlan,
} from "./types";

export async function listConversations(): Promise<ConversationSummary[]> {
  return await expected<ConversationSummary[]>(await request("/api/conversations"));
}

export async function startConversation(): Promise<ConversationSummary> {
  return await expected<ConversationSummary>(
    await request("/api/conversations", { method: "POST" }),
  );
}

export async function readConversation(id: string): Promise<ConversationRead> {
  return await expected<ConversationRead>(await request(`/api/conversations/${id}`));
}

/** Every Trip the traveler is planning, the most recently started first. */
export async function listTrips(): Promise<TripPlan[]> {
  return await expected<TripPlan[]>(await request("/api/trips"));
}

/**
 * Move a Conversation to a Trip, or take it off the one it is on. Answers with
 * the plan the pane beside it shows next, and null when there is none.
 */
export async function attachConversation(
  conversationId: string,
  tripId: string | null,
): Promise<TripPlan | null> {
  return await expected<TripPlan | null>(
    await request(`/api/conversations/${conversationId}/trip`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trip_id: tripId }),
    }),
  );
}

/**
 * Delete a Trip and its Trip Plan, and say what becomes of its Conversations.
 *
 * The plan goes either way. What happens to the Conversations is the
 * traveler's choice, sent as the word they chose rather than as a flag, so
 * what the request does can be read in the request.
 */
export async function deleteTrip(
  tripId: string,
  conversations: "keep" | "delete",
): Promise<void> {
  refused(
    await request(`/api/trips/${tripId}?conversations=${conversations}`, { method: "DELETE" }),
  );
}

/**
 * Changing the Trip Plan by hand.
 *
 * Each answers with the whole plan — one round trip rather than a write and a
 * read. What they *write* is only what was named: a field left out is not
 * touched, and a field named as null is one the traveler emptied.
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
    await request(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    }),
  );
}

/**
 * Call a Conversation something the traveler will recognise it by. Answers
 * with the row as the list now reads it: what is stored is trimmed and
 * measured by the server, and a rail showing what was typed would be guessing.
 */
export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationSummary> {
  return await expected<ConversationSummary>(
    await request(`/api/conversations/${id}/title`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}

export async function deleteConversation(id: string): Promise<void> {
  refused(await request(`/api/conversations/${id}`, { method: "DELETE" }));
}

/**
 * The Traveler Profile, and the two ways it goes away. Deleting one fact
 * answers with the whole profile, as a plan change answers with the whole plan.
 */

export async function readProfile(): Promise<ProfileFact[]> {
  return await expected<ProfileFact[]>(await request("/api/traveler/profile"));
}

export async function forgetProfileFact(factId: string): Promise<ProfileFact[]> {
  return await expected<ProfileFact[]>(
    await request(`/api/traveler/profile/${factId}`, { method: "DELETE" }),
  );
}

/**
 * Every Conversation, every Trip, the whole profile and the Advisor
 * Instructions, gone. A Guest goes with them, so their token is let go of too
 * and the next write starts a new one.
 */
export async function clearEverything(): Promise<void> {
  refused(await request("/api/traveler/everything", { method: "DELETE" }));
  forgetGuest();
}

/**
 * The Advisor Instructions, and the two ways they change.
 *
 * Each answers with the instructions *and* the whole prompt composed around
 * them, because the page shows both.
 *
 * The Conversation is named so the plan composed into the preview is the one
 * the traveler came from, making what they see what their next message sends.
 */

export async function readInstructions(
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await request(`/api/advisor/instructions${asking(conversationId)}`),
  );
}

export async function saveInstructions(
  instructions: string,
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await request(`/api/advisor/instructions${asking(conversationId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instructions }),
    }),
  );
}

export async function restoreInstructions(
  conversationId: string | null,
): Promise<AdvisorInstructions> {
  return await expected<AdvisorInstructions>(
    await request(`/api/advisor/instructions${asking(conversationId)}`, { method: "DELETE" }),
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
  yield* turn(
    await request(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal,
    }),
  );
}

/**
 * Run a failed turn again, in place of the reply it never gave. The question
 * is already recorded, so it is not sent again — which is why this is a call
 * of its own rather than saying the same words twice.
 */
export async function* runAgain(
  conversationId: string,
  messageId: string,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent> {
  yield* turn(
    await request(`/api/conversations/${conversationId}/messages/${messageId}/again`, {
      method: "POST",
      signal,
    }),
  );
}

async function* turn(response: Response): AsyncGenerator<TurnEvent> {
  if (!response.ok || !response.body) {
    yield { type: "failed", message: null, ...(await refusal(response)) };
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

/**
 * Where the API is, fixed at build time. Empty is the page's own origin, as
 * the combined image and the Vite dev server's proxy serve it; a frontend on a
 * host of its own is built with the backend's origin here.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/**
 * The Guest token: what the server knows this browser's Guest by. It is handed
 * over once, on the write that made them a Guest, and never again, so it is
 * kept across reloads and tabs rather than in memory.
 */
const GUEST_TOKEN_KEY = "travel-advisor.guest-token";
const GUEST_TOKEN_HEADER = "X-Guest-Token";

/**
 * Whether this browser's Guest has put away the notice that their work is
 * deleted after a day without use. Kept against their token: a new one clears
 * it, so a Guest whose visit was swept or deleted is told again on the next.
 */
const GUEST_NOTICE_KEY = "travel-advisor.guest-notice-dismissed";

/**
 * `fetch`, as this browser's Traveler. The token goes with every request, the
 * streamed turn included, and one the response hands back replaces it. Read
 * afresh each time, so a Guest begun in another tab is the one asking here.
 */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = stored(() => localStorage.getItem(GUEST_TOKEN_KEY));
  if (token) headers.set(GUEST_TOKEN_HEADER, token);
  const response = await fetch(API_BASE_URL + url, { ...init, headers });
  const issued = response.headers.get(GUEST_TOKEN_HEADER);
  if (issued !== null) {
    stored(() => localStorage.setItem(GUEST_TOKEN_KEY, issued));
    // A new token is a new Guest, who has not been told yet.
    stored(() => localStorage.removeItem(GUEST_NOTICE_KEY));
  }
  return response;
}

function forgetGuest(): void {
  stored(() => localStorage.removeItem(GUEST_TOKEN_KEY));
}

/** Somebody who has written nothing has nothing to lose, so is not told. */
export function guestNoticeDue(): boolean {
  return (
    stored(() => localStorage.getItem(GUEST_TOKEN_KEY)) !== null &&
    stored(() => localStorage.getItem(GUEST_NOTICE_KEY)) === null
  );
}

export function dismissGuestNotice(): void {
  stored(() => localStorage.setItem(GUEST_NOTICE_KEY, "dismissed"));
}

/**
 * Storage a browser may refuse, in a private window or with site data
 * blocked. Nothing is kept then and every write starts a new Guest, which is
 * worse but still an application that answers.
 */
function stored<T>(using: () => T): T | null {
  try {
    return using();
  } catch {
    return null;
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

/**
 * What the API said when it would not run a turn. A refusal we composed says
 * which kind of failure it is; anything else is the application declining, and
 * is reported as its own.
 */
async function refusal(response: Response): Promise<Failure> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body.detail;
    if (typeof detail === "string") return { kind: "application", detail };
    if (isFailure(detail)) return detail;
  } catch {
    // A response that is not the API's own JSON says nothing useful.
  }
  return { kind: "application", detail: "The advisor could not answer." };
}

function isFailure(detail: unknown): detail is Failure {
  if (typeof detail !== "object" || detail === null) return false;
  const given = detail as Partial<Failure>;
  return typeof given.kind === "string" && typeof given.detail === "string";
}
