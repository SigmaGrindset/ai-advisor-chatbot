import { useEffect, useRef, useState } from "react";

import {
  deleteConversation,
  listConversations,
  readConversation,
  say,
  startConversation,
  type Conversation,
  type ConversationSummary,
  type Message,
} from "./api";
import { ConversationList } from "./ConversationList";

/** A reply as it is being written, and which Conversation it belongs to. */
type Arriving = { conversationId: string; text: string };

export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Null is a Conversation the traveler has begun but not yet said anything in.
  // It has no row in the list and no row in the database until they do.
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The most recently active Conversation is the one they were working in, so
    // a reload puts them back rather than somewhere they have to navigate from.
    void resume()
      .then(([listed, opened]) => {
        setConversations(listed);
        setCurrent(opened);
      })
      .catch(() => setFailure("Your conversations could not be loaded."));
  }, []);

  useEffect(() => {
    // Follow the reply as it is written. Staying put when the traveler has
    // scrolled up is a later ticket's job.
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [current, arriving]);

  function start() {
    setConfirmingDelete(null);
    setFailure(null);
    setCurrent(null);
  }

  async function open(id: string) {
    setConfirmingDelete(null);
    if (id === current?.id) return;
    setFailure(null);
    try {
      setCurrent(await readConversation(id));
    } catch {
      setFailure("That conversation could not be opened.");
    }
  }

  async function remove(id: string) {
    setConfirmingDelete(null);
    setFailure(null);
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setConversations(remaining);
      if (id !== current?.id) return;
      // They deleted what they were reading, so something has to take its place:
      // the next one down, or a blank Conversation if that was the last of them.
      const next = remaining[0];
      setCurrent(next === undefined ? null : await readConversation(next.id));
    } catch {
      setFailure("That conversation could not be deleted.");
    }
  }

  async function send() {
    const saying = draft.trim();
    if (!saying || arriving !== null) return;
    setDraft("");
    setFailure(null);
    setConfirmingDelete(null);

    let conversationId: string;
    try {
      // A Conversation the traveler never says anything in is one that never
      // needed to exist, so it is started by the first thing they say in it.
      conversationId = current?.id ?? (await begin());
    } catch {
      setFailure("A new conversation could not be started.");
      setDraft(saying);
      return;
    }

    setArriving({ conversationId, text: "" });
    setConversations((sofar) => mostRecentFirst(sofar, conversationId));
    try {
      for await (const event of say(conversationId, saying)) {
        if (event.type === "fragment") {
          const text = event.text;
          setArriving((sofar) =>
            sofar?.conversationId === conversationId
              ? { conversationId, text: sofar.text + text }
              : sofar,
          );
        } else if (event.type === "conversation_titled") {
          const title = event.title;
          setConversations((sofar) =>
            sofar.map((it) => (it.id === conversationId ? { ...it, title } : it)),
          );
          setCurrent((open) => (open?.id === conversationId ? { ...open, title } : open));
        } else if (event.type === "failed") {
          // The turn never happened, so the traveler gets their words back
          // rather than having to type them again.
          setFailure(event.detail);
          setDraft(saying);
        } else {
          const message = event.message;
          setCurrent((open) =>
            open?.id === conversationId
              ? { ...open, messages: [...open.messages, message] }
              : open,
          );
        }
      }
    } catch {
      setFailure("The advisor could not be reached.");
      setDraft(saying);
    } finally {
      setArriving(null);
    }
  }

  /** Give the open Conversation a row of its own, and answer with its identifier. */
  async function begin(): Promise<string> {
    const started = await startConversation();
    setConversations((sofar) => [started, ...sofar]);
    setCurrent({ id: started.id, title: started.title, messages: [] });
    return started.id;
  }

  const writing = arriving?.conversationId === current?.id ? arriving : null;

  return (
    <div className="flex h-dvh">
      <ConversationList
        conversations={conversations}
        currentId={current?.id ?? null}
        confirmingDelete={confirmingDelete}
        onStart={start}
        onOpen={(id) => void open(id)}
        onConfirmDelete={setConfirmingDelete}
        onDelete={(id) => void remove(id)}
      />

      <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold">{current?.title ?? "AI Travel Advisor"}</h1>

        <div ref={transcript} className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {(current?.messages.length ?? 0) === 0 && writing === null && (
            <p className="text-neutral-500">
              Ask about a trip you are planning, and the advisor will answer here.
            </p>
          )}
          {current?.messages.map((message) => (
            <MessageView key={message.id} role={message.role} content={message.content} />
          ))}
          {writing !== null && <MessageView role="advisor" content={writing.text} />}
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
    </div>
  );
}

/** What to show on arrival: every Conversation, and the one last worked in. */
async function resume(): Promise<[ConversationSummary[], Conversation | null]> {
  const listed = await listConversations();
  const mostRecent = listed[0];
  if (mostRecent === undefined) return [listed, null];
  return [listed, await readConversation(mostRecent.id)];
}

/** The list as the server would order it once this Conversation has been used. */
function mostRecentFirst(
  conversations: ConversationSummary[],
  conversationId: string,
): ConversationSummary[] {
  const used = conversations.find((it) => it.id === conversationId);
  if (used === undefined) return conversations;
  return [used, ...conversations.filter((it) => it.id !== conversationId)];
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
