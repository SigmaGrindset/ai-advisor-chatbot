/**
 * One turn, from the words the traveler types to the reply on the page.
 *
 * A turn is the only thing here that unfolds over time: the reply arrives a
 * fragment at a time, may be stopped part-written, may fail, and may start a
 * Conversation and name it on the way. Holding all of that here lets what
 * shows a turn stay a component that draws what it is handed.
 *
 * The reply being written is the turn's own and is put away when it ends; the
 * Messages and rows it produces outlive it and are handed outward, which is
 * why this is given the open Conversation rather than a copy of it.
 */

import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { runAgain, say, startConversation } from "../api/client";
import type {
  Conversation,
  ConversationSummary,
  Failure,
  Message,
  ProfileFact,
  TripPlan,
} from "../api/types";
import type { TurnEvent } from "./events";

/**
 * A turn that left nothing behind, kept so the traveler can ask it again.
 * Only turns that never reached the server: anything that did is a Message
 * carrying its own failure, which outlives a reload.
 */
export type Unrecorded = { conversationId: string; asked: string } & Failure;

type Arriving = { conversationId: string; text: string };

type Stopped = { conversationId: string; text: string };

type Consulting = { conversationId: string; activity: string };

/** The turn, as the Conversation on screen has to show it. */
export type Turn = {
  draft: string;
  setDraft: (draft: string) => void;
  /** The reply being written into the open Conversation, if one is. */
  arriving: string | null;
  /** Names the lookup rather than the turn, so a pause reads as progress. */
  consulting: string | null;
  unrecorded: Unrecorded | null;
  stopped: string | null;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  /** Say what is in the composer, and empty it. */
  send: () => void;
  again: (asking: Unrecorded) => void;
  /** Run a failed turn again. Its question is already recorded, so it is not
   * said twice. */
  retry: (failed: Message) => void;
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
  onProfileRevised,
}: {
  conversation: Conversation | null;
  /** A turn adds Messages to it, and may name it. */
  onConversation: Dispatch<SetStateAction<Conversation | null>>;
  /** A turn adds a row, renames one and reorders one. */
  onListed: Dispatch<SetStateAction<ConversationSummary[]>>;
  /**
   * Whatever else the page shows that a turn supersedes. Called when the
   * traveler asks, before the turn is known to have anywhere to go.
   */
  onAsking: () => void;
  /** Something that went wrong around the Conversation rather than in a turn. */
  onFailure: (failure: string) => void;
  /** A Conversation now exists that did not. It has no Trip Plan yet. */
  onBegan: (conversationId: string) => void;
  /**
   * The Trip Plan as it now stands, and what moved. Which Conversation it
   * belongs to is passed on rather than resolved here — a plan arriving into
   * one the traveler has left is the holder's question.
   */
  onPlanRevised: (conversationId: string, plan: TripPlan, changed: string[]) => void;
  /** No Conversation comes with it: there is one profile and all are shown it. */
  onProfileRevised: (profile: ProfileFact[]) => void;
}): Turn {
  const [draft, setDraft] = useState("");
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const [unrecorded, setUnrecorded] = useState<Unrecorded | null>(null);
  const [stopped, setStopped] = useState<Stopped | null>(null);
  const [consulting, setConsulting] = useState<Consulting | null>(null);
  // The turn in flight, held so the stop control has something to pull on.
  const inFlight = useRef<AbortController | null>(null);

  function forget() {
    setUnrecorded(null);
    setStopped(null);
  }

  function send() {
    const saying = draft.trim();
    if (saying === "" || arriving !== null) return;
    setDraft("");
    void ask(saying, () => setDraft(saying));
  }

  /**
   * Goes as a new turn, and can, because nothing was recorded the first time.
   * A turn that did reach the server is `retry` instead.
   */
  function again(asking: Unrecorded) {
    if (arriving !== null) return;
    setUnrecorded(null);
    void ask(asking.asked, () => setUnrecorded(asking));
  }

  /**
   * The Message it left comes off the transcript as the new turn starts and
   * goes back if the turn could not start, matching the server, which discards
   * it in the same breath as it composes the prompt.
   */
  function retry(failed: Message) {
    const open = conversation;
    // One turn at a time, as `send` keeps: a failed Message stays the last
    // recorded while the next reply arrives, so its control stays on screen.
    if (open === null || arriving !== null) return;
    forget();
    onAsking();
    revise(open.id, (said) => said.filter((message) => message.id !== failed.id));
    void run({
      conversationId: open.id,
      events: (signal) => runAgain(open.id, failed.id, signal),
      // Nothing was run, so the Message goes back where it was. The question
      // is still in the transcript above it.
      refused: (failure) => {
        revise(open.id, (said) => [...said, failed]);
        onFailure(failure.detail);
      },
    });
  }

  function stop() {
    inFlight.current?.abort();
  }

  /**
   * `giveBack` says what to do with the words if the turn never starts — the
   * composer wants them back, a retry wants its error back where it was.
   */
  async function ask(asking: string, giveBack: () => void) {
    // Put down the moment they ask rather than a round trip later.
    forget();
    onAsking();

    let conversationId: string;
    try {
      // A Conversation nobody says anything in never needed to exist, so the
      // first thing they say starts it.
      conversationId = conversation?.id ?? (await begin());
    } catch {
      // Nothing was recorded, so the words go back rather than becoming a
      // failed turn to retry.
      onFailure("A new conversation could not be started.");
      giveBack();
      return;
    }
    await run({
      conversationId,
      events: (signal) => say(conversationId, asking, signal),
      // The question exists nowhere else, so it goes on the page with the
      // failure under it and a way to ask again.
      refused: (failure) => setUnrecorded({ conversationId, asked: asking, ...failure }),
    });
  }

  /**
   * One turn, watched from the first event to the last. The two ways in differ
   * only in how they start and in what `refused` means.
   */
  async function run({
    conversationId,
    events,
    refused,
  }: {
    conversationId: string;
    events: (signal: AbortSignal) => AsyncGenerator<TurnEvent>;
    refused: (failure: Failure) => void;
  }) {
    const stopping = new AbortController();
    inFlight.current = stopping;
    setArriving({ conversationId, text: "" });
    onListed((sofar) => mostRecentFirst(sofar, conversationId));

    // Kept alongside the state so stopping mid-reply knows what had arrived: a
    // state setter is not somewhere to read a value back out of.
    let written = "";
    // Whether the turn became a Message before the traveler stopped it.
    let kept = false;

    /**
     * A landed reply stops being one that is arriving: the turn may still be
     * naming the Conversation, but leaving it arriving would draw the reply
     * twice and offer to stop something already kept.
     */
    const arrived = (message: Message, { replying }: { replying: boolean }) => {
      revise(conversationId, (said) => [...said, message]);
      if (!replying) return;
      kept = true;
      setArriving((sofar) => (sofar?.conversationId === conversationId ? null : sofar));
    };

    try {
      for await (const event of events(stopping.signal)) {
        if (event.type === "fragment") {
          written += event.text;
          const text = written;
          setArriving((sofar) => (sofar?.conversationId === conversationId ? { conversationId, text } : sofar));
        } else if (event.type === "consulting") {
          const activity = event.activity;
          setConsulting({ conversationId, activity });
        } else if (event.type === "plan_revised") {
          onPlanRevised(conversationId, event.plan, event.changed);
        } else if (event.type === "profile_revised") {
          onProfileRevised(event.profile);
        } else if (event.type === "consulted") {
          setConsulting((sofar) => (sofar?.conversationId === conversationId ? null : sofar));
        } else if (event.type === "conversation_titled") {
          const title = event.title;
          onListed((sofar) =>
            sofar.map((it) => (it.id === conversationId ? { ...it, title } : it)),
          );
          onConversation((open) => (open?.id === conversationId ? { ...open, title } : open));
        } else if (event.type === "failed") {
          // A failure the server recorded comes with the Message it left; one
          // it never heard about comes with none, and the question is only here.
          if (event.message === null) refused({ kind: event.kind, detail: event.detail });
          else arrived(event.message, { replying: true });
        } else {
          arrived(event.message, { replying: event.type === "advisor_message" });
        }
      }
    } catch {
      if (stopping.signal.aborted) {
        // A reply the server already kept is not a stopped one — it is on the
        // page as a Message. Otherwise the stop is recorded even with nothing
        // to keep: pressing a control and being told nothing is worse.
        if (!kept) setStopped({ conversationId, text: written });
      } else {
        // The connection went rather than the turn, so whatever the server
        // made of it never arrived and this is the only account of it.
        refused({ kind: "upstream", detail: "The advisor could not be reached." });
      }
    } finally {
      inFlight.current = null;
      setArriving(null);
      // Including when it was stopped or dropped part-way through a lookup.
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

  /** Revise the Messages of one Conversation, if it is still the one open. */
  function revise(conversationId: string, revising: (said: Message[]) => Message[]) {
    onConversation((open) =>
      open?.id === conversationId ? { ...open, messages: revising(open.messages) } : open,
    );
  }

  /** Only what belongs to the Conversation on screen is shown on it. */
  const here = <T extends { conversationId: string }>(it: T | null) =>
    it?.conversationId === conversation?.id ? it : null;

  return {
    draft,
    setDraft,
    arriving: here(arriving)?.text ?? null,
    consulting: here(consulting)?.activity ?? null,
    unrecorded: here(unrecorded),
    stopped: here(stopped)?.text ?? null,
    sending: arriving !== null,
    send,
    again,
    retry,
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
