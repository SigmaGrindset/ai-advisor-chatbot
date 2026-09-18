import { useEffect, useRef, useState } from "react";

import { readConversation, say, type Message } from "./api";

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  // The reply as it is being written. Null when no turn is in flight.
  const [arriving, setArriving] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    readConversation()
      .then((conversation) => setMessages(conversation.messages))
      .catch(() => setFailure("The conversation could not be loaded."));
  }, []);

  useEffect(() => {
    // Follow the reply as it is written. Staying put when the traveler has
    // scrolled up is a later ticket's job.
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [messages, arriving]);

  async function send() {
    const saying = draft.trim();
    if (!saying || arriving !== null) return;
    setDraft("");
    setFailure(null);
    setArriving("");
    try {
      for await (const event of say(saying)) {
        if (event.type === "fragment") {
          setArriving((sofar) => (sofar ?? "") + event.text);
        } else if (event.type === "failed") {
          // The turn never happened, so the traveler gets their words back
          // rather than having to type them again.
          setFailure(event.detail);
          setDraft(saying);
        } else if (event.type === "traveler_message" || event.type === "advisor_message") {
          setMessages((sofar) => [...sofar, event.message]);
        }
      }
    } catch {
      setFailure("The advisor could not be reached.");
      setDraft(saying);
    } finally {
      setArriving(null);
    }
  }

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">AI Travel Advisor</h1>

      <div ref={transcript} className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {messages.length === 0 && arriving === null && (
          <p className="text-neutral-500">
            Ask about a trip you are planning, and the advisor will answer here.
          </p>
        )}
        {messages.map((message) => (
          <MessageView key={message.id} role={message.role} content={message.content} />
        ))}
        {arriving !== null && <MessageView role="advisor" content={arriving} />}
        {failure && <p className="text-red-700">{failure}</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(submitted) => {
          submitted.preventDefault();
          void send();
        }}
      >
        <textarea
          className="flex-1 resize-none rounded border border-neutral-300 p-2"
          rows={2}
          value={draft}
          placeholder="Where are you going?"
          aria-label="Message the advisor"
          onChange={(typed) => setDraft(typed.target.value)}
          onKeyDown={(pressed) => {
            if (pressed.key === "Enter" && !pressed.shiftKey) {
              pressed.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="self-end rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
          disabled={draft.trim() === "" || arriving !== null}
        >
          Send
        </button>
      </form>
    </main>
  );
}

function MessageView({ role, content }: { role: Message["role"]; content: string }) {
  return (
    <article className="flex flex-col gap-1">
      <h2 className="text-xs tracking-wide text-neutral-500 uppercase">
        {role === "traveler" ? "You" : "Advisor"}
      </h2>
      <p className="whitespace-pre-wrap">{content}</p>
    </article>
  );
}
