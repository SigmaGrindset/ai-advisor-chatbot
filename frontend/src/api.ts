/**
 * The application's own API, and the reader for its streamed turns.
 *
 * A turn is a POST that answers with server-sent events, so it is read with a
 * stream reader rather than an EventSource — EventSource can only GET. Lines
 * that are not `data:` lines, including keep-alive comments, are dropped.
 */

export type MessageRole = "traveler" | "advisor";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  cost_usd: number | null;
};

/** A Conversation as it appears in the list, without its transcript. */
export type ConversationSummary = {
  id: string;
  /** Null until the first exchange has been named. */
  title: string | null;
  last_activity_at: string;
};

export type Conversation = {
  id: string;
  title: string | null;
  messages: Message[];
};

export type TurnEvent =
  | { type: "traveler_message"; message: Message }
  | { type: "fragment"; text: string }
  | { type: "advisor_message"; message: Message }
  | { type: "conversation_titled"; title: string }
  | { type: "failed"; detail: string };

export async function listConversations(): Promise<ConversationSummary[]> {
  return await expected<ConversationSummary[]>(await fetch("/api/conversations"));
}

export async function startConversation(): Promise<ConversationSummary> {
  return await expected<ConversationSummary>(
    await fetch("/api/conversations", { method: "POST" }),
  );
}

export async function readConversation(id: string): Promise<Conversation> {
  return await expected<Conversation>(await fetch(`/api/conversations/${id}`));
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
