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

export type Conversation = {
  id: string;
  messages: Message[];
};

export type TurnEvent =
  | { type: "traveler_message"; message: Message }
  | { type: "fragment"; text: string }
  | { type: "advisor_message"; message: Message }
  | { type: "failed"; detail: string };

export async function readConversation(): Promise<Conversation> {
  const response = await fetch("/api/conversation");
  if (!response.ok) throw new Error("The conversation could not be loaded.");
  return (await response.json()) as Conversation;
}

/** Say something to the advisor, and yield what comes back as it arrives. */
export async function* say(content: string): AsyncGenerator<TurnEvent> {
  const response = await fetch("/api/conversation/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
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

async function refusal(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // A response that is not the API's own JSON says nothing useful.
  }
  return "The advisor could not answer.";
}
