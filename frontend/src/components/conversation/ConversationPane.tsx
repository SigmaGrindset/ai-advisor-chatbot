import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, MapPinned, PanelLeft, RotateCcw, TriangleAlert } from "lucide-react";

import { settled } from "./announcing";
import type { Conversation, Message } from "../../api/types";
import { Composer } from "./Composer";
import { conversationName } from "./conversationName";
import { icon, smallIcon } from "../../design/icons";
import { atBottom, toFoot } from "./following";
import { GREETING, STARTERS } from "./firstRun";
import { spoken } from "./markdown";
import { Prose } from "./Prose";
import type { Trouble } from "../../stream/useTurn";

/** One thing the live region has been given to read out, in its turn. */
type Announcement = { at: number; text: string };

export function ConversationPane({
  conversation,
  arriving,
  trouble,
  stopped,
  failure,
  draft,
  sending,
  onDraft,
  onSend,
  onStop,
  onRetry,
  onShowConversations,
  onShowRecord,
}: {
  /** The Conversation being read, or null before the traveler has begun one. */
  conversation: Conversation | null;
  /** The reply as it is being written, if one is arriving into this Conversation. */
  arriving: string | null;
  /** The last turn in this Conversation, if it failed. */
  trouble: Trouble | null;
  /**
   * What had arrived of a reply the traveler stopped, and null if they
   * stopped none. Empty when they stopped one before it had written anything.
   */
  stopped: string | null;
  /** Something that went wrong around the Conversation rather than in a turn. */
  failure: string | null;
  draft: string;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  onDraft: (draft: string) => void;
  onSend: () => void;
  /** How to stop this Conversation's reply, and null when it has none. */
  onStop: (() => void) | null;
  onRetry: (trouble: Trouble) => void;
  /**
   * How to reach what this width has folded away, and null at a width that
   * has folded nothing away. The controls are the shell's, drawn here because
   * the header is the only thing on a phone with room for them.
   */
  onShowConversations: (() => void) | null;
  onShowRecord: (() => void) | null;
}) {
  const transcript = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Whether the foot is where the traveler is reading, for the control that
  // offers them the way back. It starts true because a Conversation opens at
  // its end. What the view actually does is decided by `atFoot` below.
  const [following, setFollowing] = useState(true);

  const replying = arriving !== null;
  const said = conversation?.messages ?? [];
  const last = said[said.length - 1];

  // Read during the render, which is the transcript as it stands *before* this
  // update reaches the page — the only moment that can say whether the
  // traveler was at the foot before the arriving reply made it taller. A
  // layout effect is already too late: by the time one runs the reply has
  // grown the transcript and every position looks scrolled away from. The
  // scroll listener cannot answer it either, because a browser delivers one
  // coalesced scroll event per frame, and a frame that contains both the
  // traveler's wheel and the view following the reply reports only the foot.
  const view = transcript.current;
  const atFoot = view === null || atBottom(view);

  useLayoutEffect(() => {
    // Follow the reply only for a traveler who was at the foot when it grew.
    // One who had scrolled up to re-read something keeps their place.
    if (!atFoot) return;
    toFoot(view);
  });

  useEffect(() => {
    // A different Conversation opens at its own end, whatever was true of the
    // one before it.
    rejoin();
  }, [conversation?.id]);

  /** Go to the foot, where the reply is, and follow it from there. */
  function rejoin() {
    setFollowing(true);
    toFoot(transcript.current);
  }

  const announcements = useAnnouncement({ replying, arriving, stopped, reply: last });

  const untouched =
    said.length === 0 && arriving === null && trouble === null && stopped === null;

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
        {onShowConversations !== null && (
          <button
            type="button"
            aria-label="Conversations"
            aria-haspopup="dialog"
            className="shrink-0 rounded-control p-2 text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            onClick={onShowConversations}
          >
            <PanelLeft {...icon} aria-hidden="true" />
          </button>
        )}

        <h1 className="min-w-0 flex-1 truncate font-display text-title font-semibold text-ink">
          {conversationName(conversation?.title ?? null)}
        </h1>

        {onShowRecord !== null && (
          <button
            type="button"
            aria-label="Trip details"
            aria-haspopup="dialog"
            className="shrink-0 rounded-control p-2 text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            onClick={onShowRecord}
          >
            <MapPinned {...icon} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={transcript}
          onScroll={(scrolled) => setFollowing(atBottom(scrolled.currentTarget))}
          // Contained, so a flick past the end of the transcript does not
          // carry on into whatever is behind it and does not rubber-band the
          // page itself.
          className="h-full overflow-y-auto overscroll-contain px-4 py-8 sm:px-6"
        >
          <div className="mx-auto flex max-w-reading flex-col gap-8">
            {untouched && (
              <FirstRun
                onStarter={(prompt) => {
                  // Filled, not sent: the opening is a starting point, and the
                  // traveler is the one who decides it is right.
                  onDraft(prompt);
                  field.current?.focus();
                }}
              />
            )}

            {said.map((message) => (
              <MessageView key={message.id} role={message.role} content={message.content} />
            ))}

            {arriving !== null && <MessageView role="advisor" content={arriving} writing />}

            {stopped !== null && stopped !== "" && (
              <MessageView role="advisor" content={stopped}>
                <p className="text-meta text-ink-subtle">
                  You stopped this reply, so it was not kept.
                </p>
              </MessageView>
            )}

            {trouble !== null && (
              <>
                {/* A turn can fail before the traveler's own words were
                    recorded, and when it does they are only here. */}
                {last?.content !== trouble.asked && (
                  <MessageView role="traveler" content={trouble.asked} />
                )}
                <div
                  role="alert"
                  className="flex flex-col items-start gap-3 rounded-panel bg-error-tint px-4 py-3"
                >
                  <p className="flex items-start gap-2 text-meta text-error">
                    <TriangleAlert {...smallIcon} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {trouble.detail}
                  </p>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-control border border-line-strong bg-surface px-3 py-1.5 text-meta font-medium text-ink shadow-raised transition-colors hover:bg-canvas"
                    onClick={() => onRetry(trouble)}
                  >
                    <RotateCcw {...smallIcon} aria-hidden="true" />
                    Ask again
                  </button>
                </div>
              </>
            )}

            {failure !== null && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-panel bg-error-tint px-4 py-3 text-meta text-error"
              >
                <TriangleAlert {...smallIcon} className="mt-0.5 shrink-0" aria-hidden="true" />
                {failure}
              </p>
            )}
          </div>
        </div>

        {!following && (
          <button
            type="button"
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-chip border border-line-strong bg-surface px-3 py-1.5 text-meta font-medium text-ink shadow-raised transition-colors hover:bg-canvas"
            onClick={rejoin}
          >
            <ArrowDown {...smallIcon} aria-hidden="true" />
            Jump to latest
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-4 pt-4 pb-composer sm:px-6">
        <Composer
          field={field}
          draft={draft}
          sending={sending}
          onDraft={onDraft}
          onSend={onSend}
          onStop={onStop}
        />
      </div>

      {/* Mounted from the start and empty, because a live region that arrives
          already holding its text is commonly not announced at all. Each
          sentence is added as a node of its own rather than replacing the
          last, both because `additions` is what a reader is watching for and
          because two turns running say "The advisor is replying." — the same
          string written twice is not a change anybody would report. */}
      <div aria-live="polite" aria-relevant="additions" className="sr-only">
        {announcements.map((announcement) => (
          <p key={announcement.at}>{announcement.text}</p>
        ))}
      </div>
    </main>
  );
}

/**
 * What a screen reader is told about a reply it cannot watch arrive.
 *
 * The reply is read out as it is written, a sentence at a time, because
 * following the answer as it arrives is the whole of what streaming is for
 * and a traveler using a screen reader is owed the same thing as one watching
 * the caret. Each sentence is *added* to the region rather than replacing
 * what is there, which is what makes a reader read it rather than abandon the
 * last one; the markup is dropped first, since "hash hash" is not a word
 * anybody said. A turn that failed is not announced here — its error is an
 * alert of its own, and saying it twice is worse than saying it once.
 */
function useAnnouncement({
  replying,
  arriving,
  stopped,
  reply,
}: {
  replying: boolean;
  arriving: string | null;
  stopped: string | null;
  reply: Message | undefined;
}): Announcement[] {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  /** Add something to be read out, after whatever is still being read. */
  const say = (text: string) =>
    setAnnouncements((said) =>
      // Only the tail is kept: what a reader has already spoken is of no use
      // to anyone, and an hour of Conversation is not a thing to hold in a
      // hidden element.
      [...said, { at: (said[said.length - 1]?.at ?? 0) + 1, text }].slice(-KEPT),
    );

  // How much of this reply has been read out already, so that a fragment
  // arriving does not start it again from the beginning.
  const announced = useRef(0);
  const began = useRef(false);

  useEffect(() => {
    if (!replying) return;
    if (!began.current) {
      began.current = true;
      announced.current = 0;
      say("The advisor is replying.");
    }
    const sofar = spoken(arriving ?? "");
    const upto = settled(sofar);
    if (upto > announced.current) {
      say(sofar.slice(announced.current, upto).trim());
      announced.current = upto;
    }
  }, [replying, arriving]);

  // What is on screen at the moment the reply stops moving, which is not what
  // the effect below closed over when the reply started. Written in an effect
  // of its own rather than during the render, and declared first, because
  // effects run in the order they are written: by the time the one below
  // reads this, this commit has already put the finished reply in it.
  const now = useRef({ stopped, reply });
  useEffect(() => {
    now.current = { stopped, reply };
  });

  useEffect(() => {
    if (replying) return;
    // Only a reply this visit watched arrive is announced; the last reply of a
    // Conversation being reopened is something they came here to read.
    if (!began.current) return;
    began.current = false;
    const { stopped: called, reply: written } = now.current;
    if (called !== null) {
      say("The reply was stopped.");
      return;
    }
    // Whatever the last sentence never closed is released now that nothing
    // more is coming.
    const whole = spoken(written?.role === "advisor" ? written.content : "");
    const tail = whole.slice(announced.current, settled(whole, true)).trim();
    if (tail !== "") say(tail);
  }, [replying]);

  return announcements;
}

/** How many announcements stay in the region behind the newest one. */
const KEPT = 8;

/** The greeting and the openings, drawn. Why they exist is in `firstRun.ts`. */
function FirstRun({ onStarter }: { onStarter: (prompt: string) => void }) {
  return (
    <section className="flex flex-col gap-6 pt-2">
      <p className="max-w-[26ch] font-display text-display text-ink">{GREETING}</p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {STARTERS.map((starter) => (
          <li key={starter.asks} className="flex">
            <button
              type="button"
              className="flex w-full flex-col gap-1 rounded-panel border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
              onClick={() => onStarter(starter.prompt)}
            >
              <span className="text-meta font-medium text-ink">{starter.label}</span>
              <span className="text-meta text-ink-muted">{starter.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MessageView({
  role,
  content,
  writing = false,
  children,
}: {
  role: Message["role"];
  content: string;
  /** True while this Message is still being written into the Conversation. */
  writing?: boolean;
  /** Anything belonging to this Message rather than to the transcript. */
  children?: React.ReactNode;
}) {
  const traveler = role === "traveler";
  return (
    // Full width and set as prose. The two voices are told apart by the face
    // they are set in rather than by a bubble, so a long itinerary has the
    // whole measure to be read across.
    <article className="flex flex-col gap-2">
      <h2 className="font-mono text-micro uppercase text-ink-subtle">
        {traveler ? "You" : "Advisor"}
      </h2>
      {traveler ? (
        // Their own words, shown back exactly as typed. Markdown is what the
        // advisor writes, not what the traveler is made to write.
        <p className="whitespace-pre-wrap font-display text-title font-medium text-ink">
          {content}
        </p>
      ) : (
        <Prose text={content} writing={writing} />
      )}
      {children}
    </article>
  );
}
