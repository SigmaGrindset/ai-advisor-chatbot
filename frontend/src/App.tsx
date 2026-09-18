import { useEffect, useRef, useState } from "react";

import {
  deleteConversation,
  listConversations,
  readConversation,
  say,
  startConversation,
  type Conversation,
  type ConversationSummary,
} from "./api";
import { ConversationList } from "./ConversationList";
import { ConversationPane, type Trouble } from "./ConversationPane";
import { RecordPane } from "./RecordPane";

/** A reply as it is being written, and which Conversation it belongs to. */
type Arriving = { conversationId: string; text: string };

/** A reply the traveler called off, and what had arrived by then. */
type Stopped = { conversationId: string; text: string };

export function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Null is a Conversation the traveler has begun but not yet said anything in.
  // It has no row in the list and no row in the database until they do.
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [stopped, setStopped] = useState<Stopped | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // The turn in flight, held so the stop control has something to pull on.
  const turn = useRef<AbortController | null>(null);

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

  /** Everything that belongs to one Conversation's last turn, put down. */
  function clear() {
    setConfirmingDelete(null);
    setFailure(null);
    setTrouble(null);
    setStopped(null);
  }

  function start() {
    clear();
    setCurrent(null);
  }

  async function open(id: string) {
    setConfirmingDelete(null);
    if (id === current?.id) return;
    clear();
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
      clear();
      // They deleted what they were reading, so something has to take its place:
      // the next one down, or a blank Conversation if that was the last of them.
      const next = remaining[0];
      setCurrent(next === undefined ? null : await readConversation(next.id));
    } catch {
      setFailure("That conversation could not be deleted.");
    }
  }

  /** Send what is in the composer, and empty it. */
  function send() {
    const saying = draft.trim();
    if (saying === "" || arriving !== null) return;
    setDraft("");
    void ask(saying, () => setDraft(saying));
  }

  /**
   * Ask a failed question again.
   *
   * It goes as a new turn, because that is all the API offers: the traveler's
   * own Message was already recorded before the turn failed, so asking again
   * records a second one. Ticket 14 owns what becomes of a traveler Message
   * whose turn never answered.
   */
  function again(asking: Trouble) {
    setTrouble(null);
    void ask(asking.asked, () => setTrouble(asking));
  }

  /** Stop a reply that is still being written. */
  function stop() {
    turn.current?.abort();
  }

  /**
   * One turn, from the words to the reply.
   *
   * `giveBack` says what to do with the words if the turn never starts, which
   * is different depending on where they came from — the composer wants them
   * back in the composer, a retry wants its error back where it was.
   */
  async function ask(asking: string, giveBack: () => void) {
    clear();

    let conversationId: string;
    try {
      // A Conversation the traveler never says anything in is one that never
      // needed to exist, so it is started by the first thing they say in it.
      conversationId = current?.id ?? (await begin());
    } catch {
      // Nothing was recorded anywhere, so the words go back to the traveler
      // rather than becoming a failed turn they have to retry.
      setFailure("A new conversation could not be started.");
      giveBack();
      return;
    }

    const stopping = new AbortController();
    turn.current = stopping;
    setArriving({ conversationId, text: "" });
    setConversations((sofar) => mostRecentFirst(sofar, conversationId));

    // Kept alongside the state so that stopping mid-reply knows what had
    // arrived: a state setter is not somewhere to read a value back out of.
    let written = "";
    // Whether the reply became a Message before the traveler stopped it.
    let answered = false;

    try {
      for await (const event of say(conversationId, asking, stopping.signal)) {
        if (event.type === "fragment") {
          written += event.text;
          const text = written;
          setArriving((sofar) => (sofar?.conversationId === conversationId ? { conversationId, text } : sofar));
        } else if (event.type === "conversation_titled") {
          const title = event.title;
          setConversations((sofar) =>
            sofar.map((it) => (it.id === conversationId ? { ...it, title } : it)),
          );
          setCurrent((open) => (open?.id === conversationId ? { ...open, title } : open));
        } else if (event.type === "failed") {
          // The question stays where they asked it, with the failure under it
          // and a way to ask again.
          setTrouble({ conversationId, asked: asking, detail: event.detail });
        } else {
          const message = event.message;
          setCurrent((open) =>
            open?.id === conversationId
              ? { ...open, messages: [...open.messages, message] }
              : open,
          );
          // The reply is a Message now, so it stops being one that is
          // arriving. The turn is not over — the Conversation may still be
          // being named — but leaving it arriving would draw the reply twice,
          // and would offer to stop something that has already been kept.
          if (event.type === "advisor_message") {
            answered = true;
            setArriving((sofar) => (sofar?.conversationId === conversationId ? null : sofar));
          }
        }
      }
    } catch {
      if (stopping.signal.aborted) {
        // A reply the server had already kept is not a stopped one, whatever
        // the traveler pressed afterwards: it is on the page as a Message.
        // Otherwise the stop is recorded even when nothing had arrived to
        // keep, because pressing a control and being told nothing is worse
        // than being told there was nothing.
        if (!answered) setStopped({ conversationId, text: written });
      } else {
        setTrouble({
          conversationId,
          asked: asking,
          detail: "The advisor could not be reached.",
        });
      }
    } finally {
      turn.current = null;
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

  /** Only what belongs to the Conversation on screen is shown on it. */
  const here = <T extends { conversationId: string }>(it: T | null) =>
    it?.conversationId === current?.id ? it : null;

  return (
    // Three panes at a laptop width: what the traveler has talked about, what
    // they are talking about, and what the talking is producing.
    //
    // Below the shell breakpoint it is the third pane that stands down, not
    // the list. ADR-0006 has the list giving way first, and it will — but only
    // once 06 has built the left sheet it gives way *to*. Dropping the list
    // now would leave a narrow window with no way to reach any other
    // Conversation, so the interim keeps navigation and defers the pane whose
    // contents are still placeholders.
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <ConversationList
        conversations={conversations}
        currentId={current?.id ?? null}
        confirmingDelete={confirmingDelete}
        onStart={start}
        onOpen={(id) => void open(id)}
        onConfirmDelete={setConfirmingDelete}
        onDelete={(id) => void remove(id)}
      />

      <ConversationPane
        conversation={current}
        arriving={here(arriving)?.text ?? null}
        trouble={here(trouble)}
        stopped={here(stopped)?.text ?? null}
        failure={failure}
        draft={draft}
        sending={arriving !== null}
        onDraft={setDraft}
        onSend={send}
        onStop={here(arriving) === null ? null : stop}
        onRetry={again}
      />

      <RecordPane />
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
