/**
 * One turn, from the words the traveler types to the reply on the page.
 *
 * A turn is the only thing in the application that unfolds over time: the
 * reply arrives a fragment at a time, may be stopped part-written, may fail,
 * and may start a Conversation and name it on the way. All of that is held
 * here so that what shows a turn can stay a component that draws what it is
 * handed.
 *
 * The draft is held here too, because it is the turn before it is one: the
 * words leave the composer when the turn starts and are given back to it if
 * the turn never does. They are still kept above the transcript, which is
 * all `Composer` asks of whoever holds them.
 *
 * What a turn produces belongs to two places. The reply as it is being
 * written is the turn's own, and is put away when the turn ends. The Messages
 * and the list rows it produces outlive it, and are handed outward — which is
 * why this is given the open Conversation and the two ways to revise it
 * rather than keeping a copy of either.
 *
 * What it hands back is already the Conversation on screen's: a reply
 * arriving into one Conversation while the traveler reads another is still
 * arriving, but it is not on the page they are reading.
 */

import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { say, startConversation } from "../api/client";
import type { Conversation, ConversationSummary, TripPlan } from "../api/types";

/** A turn that did not answer, kept so the traveler can ask it again. */
export type Trouble = { conversationId: string; asked: string; detail: string };

/** A reply as it is being written, and which Conversation it belongs to. */
type Arriving = { conversationId: string; text: string };

/** A reply the traveler called off, and what had arrived by then. */
type Stopped = { conversationId: string; text: string };

/** A Live-data Tool running, and which Conversation it is running for. */
type Consulting = { conversationId: string; activity: string };

/** The turn, as the Conversation on screen has to show it. */
export type Turn = {
  /** What the traveler has typed and not yet said. */
  draft: string;
  setDraft: (draft: string) => void;
  /** The reply being written into the open Conversation, if one is. */
  arriving: string | null;
  /**
   * What is being fetched into the open Conversation right now, and null when
   * nothing is. It names the lookup rather than the turn, so a pause reads as
   * progress rather than as a hang.
   */
  consulting: string | null;
  /** The open Conversation's last turn, if it failed. */
  trouble: Trouble | null;
  /**
   * What had arrived of a reply the traveler stopped in the open
   * Conversation, and null if they stopped none.
   */
  stopped: string | null;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  /** Say what is in the composer, and empty it. */
  send: () => void;
  /** Ask a failed question again. */
  again: (asking: Trouble) => void;
  /** How to stop the reply arriving into the open Conversation, null when none is. */
  stop: (() => void) | null;
  /** Put down what the last turn left on the page, the draft excepted. */
  forget: () => void;
};

export function useTurn({
  conversation,
  onConversation,
  onListed,
  onAsking,
  onFailure,
  onBegan,
  onPlanRevised,
}: {
  /** The Conversation being read, or null before the traveler has begun one. */
  conversation: Conversation | null;
  /** How to revise it: a turn adds Messages to it, and may name it. */
  onConversation: Dispatch<SetStateAction<Conversation | null>>;
  /** How to revise the list: a turn adds a row, renames one and reorders one. */
  onListed: Dispatch<SetStateAction<ConversationSummary[]>>;
  /**
   * Whatever else the page is showing that a turn supersedes — an open row
   * menu, a failure from before. Called when the traveler asks, which is
   * before the turn is known to have anywhere to go: a turn that cannot
   * start reports that through `onFailure` like any other failure.
   */
  onAsking: () => void;
  /** Something that went wrong around the Conversation rather than in a turn. */
  onFailure: (failure: string) => void;
  /**
   * A Conversation now exists that did not a moment ago, because the traveler
   * said the first thing in it. It has no Trip Plan yet, and whoever is
   * holding one has to know that.
   */
  onBegan: (conversationId: string) => void;
  /**
   * The advisor patched the Trip Plan mid-turn: the plan as it now stands,
   * and what moved. Which Conversation it belongs to is passed on rather than
   * resolved here, because what happens to a plan arriving into a Conversation
   * the traveler has since left is the holder's question, not the turn's.
   */
  onPlanRevised: (conversationId: string, plan: TripPlan, changed: string[]) => void;
}): Turn {
  const [draft, setDraft] = useState("");
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [stopped, setStopped] = useState<Stopped | null>(null);
  const [consulting, setConsulting] = useState<Consulting | null>(null);
  // The turn in flight, held so the stop control has something to pull on.
  const inFlight = useRef<AbortController | null>(null);

  /** What the last turn left on screen, put down. */
  function forget() {
    setTrouble(null);
    setStopped(null);
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
    inFlight.current?.abort();
  }

  /**
   * One turn, from the words to the reply.
   *
   * `giveBack` says what to do with the words if the turn never starts, which
   * is different depending on where they came from — the composer wants them
   * back in the composer, a retry wants its error back where it was.
   */
  async function ask(asking: string, giveBack: () => void) {
    forget();
    onAsking();

    let conversationId: string;
    try {
      // A Conversation the traveler never says anything in is one that never
      // needed to exist, so it is started by the first thing they say in it.
      conversationId = conversation?.id ?? (await begin());
    } catch {
      // Nothing was recorded anywhere, so the words go back to the traveler
      // rather than becoming a failed turn they have to retry.
      onFailure("A new conversation could not be started.");
      giveBack();
      return;
    }

    const stopping = new AbortController();
    inFlight.current = stopping;
    setArriving({ conversationId, text: "" });
    onListed((sofar) => mostRecentFirst(sofar, conversationId));

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
        } else if (event.type === "consulting") {
          const activity = event.activity;
          setConsulting({ conversationId, activity });
        } else if (event.type === "plan_revised") {
          onPlanRevised(conversationId, event.plan, event.changed);
        } else if (event.type === "consulted") {
          setConsulting((sofar) => (sofar?.conversationId === conversationId ? null : sofar));
        } else if (event.type === "conversation_titled") {
          const title = event.title;
          onListed((sofar) =>
            sofar.map((it) => (it.id === conversationId ? { ...it, title } : it)),
          );
          onConversation((open) => (open?.id === conversationId ? { ...open, title } : open));
        } else if (event.type === "failed") {
          // The question stays where they asked it, with the failure under it
          // and a way to ask again.
          setTrouble({ conversationId, asked: asking, detail: event.detail });
        } else {
          const message = event.message;
          onConversation((open) =>
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
      inFlight.current = null;
      setArriving(null);
      // Whatever the turn was fetching, it is not fetching it any more —
      // including when it was stopped or dropped part-way through a lookup.
      setConsulting(null);
    }
  }

  /** Give the open Conversation a row of its own, and answer with its identifier. */
  async function begin(): Promise<string> {
    const started = await startConversation();
    onListed((sofar) => [started, ...sofar]);
    onConversation({ id: started.id, title: started.title, messages: [] });
    onBegan(started.id);
    return started.id;
  }

  /** Only what belongs to the Conversation on screen is shown on it. */
  const here = <T extends { conversationId: string }>(it: T | null) =>
    it?.conversationId === conversation?.id ? it : null;

  return {
    draft,
    setDraft,
    arriving: here(arriving)?.text ?? null,
    consulting: here(consulting)?.activity ?? null,
    trouble: here(trouble),
    stopped: here(stopped)?.text ?? null,
    sending: arriving !== null,
    send,
    again,
    stop: here(arriving) === null ? null : stop,
    forget,
  };
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
