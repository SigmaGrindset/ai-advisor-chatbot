import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  Check,
  Copy,
  Hourglass,
  MapPinned,
  PanelLeft,
  Radar,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";

import { settled } from "./announcing";
import type { Citation, Conversation, Failure, Message } from "../../api/types";
import { Citations } from "./Citations";
import { Composer } from "./Composer";
import { conversationName } from "./conversationName";
import { icon, smallIcon } from "../../design/icons";
import { atBottom, toFoot, toFootSmoothly } from "./following";
import { GREETING, STARTERS } from "./firstRun";
import { spoken } from "./markdown";
import { Prose } from "./Prose";
import { failureLabel } from "./failures";
import { LoadingTranscript, Skeleton } from "../shell/Skeleton";
import type { Unrecorded } from "../../stream/useTurn";
import { useWriting } from "../../stream/writing";

/** One thing the live region has been given to read out, in its turn. */
type Announcement = { at: number; text: string };

export function ConversationPane({
  conversation,
  resuming,
  arriving,
  consulting,
  unrecorded,
  stopped,
  failure,
  draft,
  sending,
  onDraft,
  onSend,
  onStop,
  onRetry,
  onAskAgain,
  onShowConversations,
  onShowRecord,
  onDismissNotice,
  peek,
}: {
  conversation: Conversation | null;
  /**
   * True until the first read has come back. A Conversation and no
   * Conversation look identical before either arrives, and the greeting is
   * only true of the second, so neither is drawn until it is known which.
   */
  resuming: boolean;
  /** The reply as it is being written, if one is arriving into this Conversation. */
  arriving: string | null;
  consulting: string | null;
  /**
   * The last turn, if it failed without reaching the server. One that reached
   * it left a Message carrying its own failure, drawn where it happened.
   */
  unrecorded: Unrecorded | null;
  /** What had arrived of a reply the traveler stopped. */
  stopped: string | null;
  failure: string | null;
  draft: string;
  /** True while a turn is in flight, whichever Conversation it belongs to. */
  sending: boolean;
  onDraft: (draft: string) => void;
  onSend: () => void;
  onStop: (() => void) | null;
  onRetry: (failed: Message) => void;
  /** Ask a question again, when nothing of the turn was kept to run. */
  onAskAgain: (asking: Unrecorded) => void;
  /**
   * How to reach what this width has folded away. The shell's controls, drawn
   * here because on a phone the header is the only thing with room for them.
   */
  onShowConversations: (() => void) | null;
  onShowRecord: (() => void) | null;
  /**
   * Puts away the notice that a Guest's work is deleted after a day without
   * use. Null once they have, and for somebody who has written nothing.
   */
  onDismissNotice: (() => void) | null;
  /**
   * The shell's Trip Plan peek, which lives here because the composer does:
   * destination and dates stay in view above it while they type.
   */
  peek: React.ReactNode;
}) {
  const transcript = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Whether the foot is where the traveler is reading, for the control that
  // offers the way back. Starts true because a Conversation opens at its end;
  // what the view actually does is decided by `atFoot` below.
  const [following, setFollowing] = useState(true);

  const replying = arriving !== null;
  // Trails what has arrived so a burst of fragments reads as writing rather
  // than as text landing in lumps. Only the drawing is paced — the live region
  // and the Message it becomes are given the whole of what arrived.
  const reply = useWriting(arriving);
  const said = conversation?.messages ?? [];
  const last = said[said.length - 1];
  // A reply is still being drawn after the last of it has arrived, so the
  // Message it became stands aside until that is done; swapping it in on time
  // would put the held-back end onto the page in one piece.
  //
  // Recognised by carrying what has been drawn so far: a turn that was stopped
  // or failed before the advisor wrote leaves something else last, which has
  // its own account to give and does not wait.
  const standingIn =
    arriving === null &&
    reply.writing &&
    last?.role === "advisor" &&
    last.content.startsWith(reply.text);
  const shown = standingIn ? said.slice(0, -1) : said;

  // Read during the render — the transcript as it stands *before* this update
  // reaches the page, which is the only moment that can say whether the
  // traveler was at the foot before the reply made it taller. A layout effect
  // is too late (the reply has already grown it), and a scroll listener cannot
  // answer either: one coalesced event per frame reports only the foot.
  const view = transcript.current;
  const atFoot = view === null || atBottom(view);

  useLayoutEffect(() => {
    // Follow the reply only for a traveler who was at the foot when it grew;
    // one who scrolled up to re-read something keeps their place.
    if (!atFoot) return;
    toFoot(view);
  });

  useEffect(() => {
    // A different Conversation opens at its own end.
    rejoin();
  }, [conversation?.id]);

  /**
   * Go to the foot, where the reply is, and follow it from there.
   *
   * Gently when the traveler asked, and at once when the Conversation changed
   * under them — that one has no distance to travel that anybody watched.
   */
  function rejoin(gently = false) {
    setFollowing(true);
    (gently ? toFootSmoothly : toFoot)(transcript.current);
  }

  const announcements = useAnnouncement({ replying, arriving, consulting, stopped, reply: last });

  const untouched =
    said.length === 0 && arriving === null && unrecorded === null && stopped === null;
  // From `shown` rather than `said`, so the notice waits until the first reply
  // has finished being drawn rather than landing in the middle of it.
  const answered = shown.some((message) => message.role === "advisor" && message.failure === null);

  return (
    // `tabIndex` so focus lands here when the skip link is followed: a browser
    // only moves focus to a fragment target that can hold it, and a landmark
    // cannot by default.
    <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
        {onShowConversations !== null && (
          <button
            type="button"
            aria-label="Conversations"
            aria-haspopup="dialog"
            className="shrink-0 rounded-control p-2 text-ink-muted pressable hover:bg-sunken hover:text-ink"
            onClick={onShowConversations}
          >
            <PanelLeft {...icon} aria-hidden="true" />
          </button>
        )}

        <h1 className="flex min-w-0 flex-1 items-center truncate font-display text-title font-semibold text-ink">
          {/* Stands in at a title's height, so the header does not change
              height when the real one lands. */}
          {resuming ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            conversationName(conversation?.title ?? null)
          )}
        </h1>

        {onShowRecord !== null && (
          <button
            type="button"
            aria-label="Trip details"
            aria-haspopup="dialog"
            className="shrink-0 rounded-control p-2 text-ink-muted pressable hover:bg-sunken hover:text-ink"
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
          // Contained, so a flick past the end does not carry on into what is
          // behind it or rubber-band the page.
          className="h-full overflow-y-auto overscroll-contain px-4 py-8 sm:px-6"
        >
          <div className="mx-auto flex max-w-reading flex-col gap-8">
            {resuming && <LoadingTranscript />}

            {!resuming && untouched && (
              <FirstRun
                onStarter={(prompt) => {
                  // Filled, not sent: the traveler decides it is right.
                  onDraft(prompt);
                  field.current?.focus();
                }}
              />
            )}

            {shown.map((message) => (
              <MessageView
                key={message.id}
                role={message.role}
                content={message.content}
                citations={message.citations}
              >
                {message.failure !== null && (
                  <NotAnswered
                    failure={message.failure}
                    // Only the last turn can be run again: a reply arriving
                    // above questions since asked would answer one they have
                    // moved on from. An older failure keeps its marker.
                    onRetry={message.id === last?.id ? () => onRetry(message) : null}
                  />
                )}
              </MessageView>
            ))}

            {/* Above the reply it holds up, so the pause reads as the advisor
                going and looking rather than as a hang. */}
            {consulting !== null && <Consulting activity={consulting} />}

            {(arriving !== null || standingIn) && (
              <MessageView role="advisor" content={reply.text} writing />
            )}

            {stopped !== null && stopped !== "" && (
              <MessageView role="advisor" content={stopped}>
                <p className="text-meta text-ink-subtle">
                  You stopped this reply, so it was not kept.
                </p>
              </MessageView>
            )}

            {unrecorded !== null && (
              <>
                {/* A turn that never reached the server recorded nothing, so
                    the traveler's own words are only here. */}
                {last?.content !== unrecorded.asked && (
                  <MessageView role="traveler" content={unrecorded.asked} />
                )}
                <NotAnswered failure={unrecorded} onRetry={() => onAskAgain(unrecorded)} />
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
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-chip border border-line-strong bg-surface px-3 py-1.5 text-meta font-medium text-ink shadow-floating pressable hover:bg-canvas"
            onClick={() => rejoin(true)}
          >
            <ArrowDown {...smallIcon} aria-hidden="true" />
            Jump to latest
          </button>
        )}
      </div>

      {onDismissNotice !== null && answered && <GuestNotice onDismiss={onDismissNotice} />}

      {peek}

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

      {/* Mounted from the start and empty: a live region arriving with its
          text already in it is commonly not announced. Each sentence is its
          own node rather than replacing the last, because `additions` is what
          a reader watches for and the same string twice is not a change. */}
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
 * Read out a sentence at a time as it is written, each one *added* rather than
 * replacing what is there so the reader speaks it instead of abandoning the
 * last. Markup is dropped first — "hash hash" is not a word anybody said. A
 * failed turn is not announced here; its error is an alert of its own.
 */
function useAnnouncement({
  replying,
  arriving,
  consulting,
  stopped,
  reply,
}: {
  replying: boolean;
  arriving: string | null;
  consulting: string | null;
  stopped: string | null;
  reply: Message | undefined;
}): Announcement[] {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  /** Add something to be read out, after whatever is still being read. */
  const say = (text: string) =>
    setAnnouncements((said) =>
      // Only the tail is kept: an hour of Conversation is not a thing to hold
      // in a hidden element.
      [...said, { at: (said[said.length - 1]?.at ?? 0) + 1, text }].slice(-KEPT),
    );

  // How much has been read out already, so an arriving fragment does not start
  // the reply again from the beginning.
  const announced = useRef(0);
  const began = useRef(false);

  useEffect(() => {
    // A traveler who cannot see the status line is owed the same account of
    // why the answer is taking a moment as one who can.
    if (consulting !== null) say(consulting);
  }, [consulting]);

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

  // What is on screen when the reply stops moving, which is not what the
  // effect below closed over when it started. Declared first because effects
  // run in order: by the time the one below reads this, it holds the finish.
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

/**
 * A turn that did not answer, and the way to have another go at it.
 *
 * The label above the sentence says whether a key is missing, credit ran out
 * or this is a bug — "something went wrong" tells none of the three.
 */
function NotAnswered({
  failure,
  onRetry,
}: {
  failure: Failure;
  /** Null on a turn that is not the one to run. */
  onRetry: (() => void) | null;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-panel bg-error-tint px-4 py-3"
    >
      <p className="flex items-start gap-2 text-meta text-error">
        <TriangleAlert {...smallIcon} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="flex flex-col gap-1">
          <span className="font-mono text-micro uppercase">{failureLabel(failure.kind)}</span>
          {failure.detail}
        </span>
      </p>
      {onRetry !== null && (
        <button
          type="button"
          className="flex items-center gap-2 rounded-control border border-line-strong bg-surface px-3 py-1.5 text-meta font-medium text-ink shadow-raised pressable hover:bg-canvas"
          onClick={onRetry}
        >
          <RotateCcw {...smallIcon} aria-hidden="true" />
          Ask again
        </button>
      )}
    </div>
  );
}

/**
 * Told once, after a Guest's first reply: nothing of theirs outlasts a day
 * without use. Above the composer rather than in the transcript, because it
 * is about the application and not something the advisor said.
 */
function GuestNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="shrink-0 px-4 pb-3 sm:px-6">
      <aside
        aria-label="Keeping your work"
        className="mx-auto flex max-w-reading animate-panel items-start gap-3 rounded-panel border border-line bg-surface py-3 ps-4 pe-2 shadow-raised"
      >
        <Hourglass {...smallIcon} className="mt-0.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-meta text-ink">
          Everything here is deleted after a day without use — your conversations, trips,
          profile and advisor instructions.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          className="-my-1 shrink-0 rounded-control p-1 text-ink-subtle pressable hover:bg-sunken hover:text-ink"
          onClick={onDismiss}
        >
          <X {...smallIcon} aria-hidden="true" />
        </button>
      </aside>
    </div>
  );
}

/** What the advisor is off fetching, for as long as it is fetching it. */
function Consulting({ activity }: { activity: string }) {
  return (
    <p className="flex animate-pulse items-center gap-2 font-mono text-micro uppercase text-ink-subtle">
      <Radar {...smallIcon} className="shrink-0" aria-hidden="true" />
      {activity}…
    </p>
  );
}

/**
 * The greeting and the openings, drawn. Why they exist is in `firstRun.ts`.
 *
 * An index and a rule each, read down — not a grid of cards. The openings are
 * a list to abandon as soon as one is close enough, not four choices of equal
 * weight to compare across, and a hairline between each is enough to separate
 * them without a border, a fill and a shadow.
 */
function FirstRun({ onStarter }: { onStarter: (prompt: string) => void }) {
  return (
    <section className="flex flex-col gap-8 pt-2">
      {/* Balanced rather than ragged: this is the largest thing on the first
          screen, and a last line holding one word is what they would notice. */}
      <p className="max-w-[24ch] font-display text-display text-balance text-ink">{GREETING}</p>

      <ul className="flex flex-col border-b border-line">
        {STARTERS.map((starter, at) => (
          <li key={starter.asks}>
            <button
              type="button"
              // Pulled out past the measure and padded back in, so the lit row
              // has a margin around the words rather than clipping them.
              className="group -mx-3 flex w-[calc(100%+1.5rem)] items-baseline gap-4 border-t border-line px-3 py-3.5 text-left pressable-row hover:bg-sunken"
              onClick={() => onStarter(starter.prompt)}
            >
              <span className="shrink-0 font-mono text-micro tabular-nums text-ink-subtle">
                {String(at + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-heading font-medium text-ink">{starter.label}</span>
                <span className="text-meta text-ink-muted">{starter.prompt}</span>
              </span>
              {/* Where the question is going: the composer, not the advisor.
                  Only under the pointer, because four arrows down the first
                  screen is four times the same instruction. */}
              <ArrowDownLeft
                {...smallIcon}
                className="ms-auto shrink-0 self-center text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
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
  citations = [],
  writing = false,
  children,
}: {
  role: Message["role"];
  content: string;
  citations?: Citation[];
  writing?: boolean;
  children?: React.ReactNode;
}) {
  const traveler = role === "traveler";
  return (
    // Full width and set as prose. The two voices are told apart by their
    // face rather than by a bubble, so a long itinerary has the whole measure.
    <article className="flex flex-col gap-2">
      <h2 className="font-mono text-micro uppercase text-ink-subtle">
        {traveler ? "You" : "Advisor"}
      </h2>
      {traveler ? (
        // Their own words, exactly as typed: Markdown is the advisor's to
        // write, not the traveler's.
        <p className="whitespace-pre-wrap font-display text-title font-medium text-ink">
          {content}
        </p>
      ) : (
        // A turn that failed before the advisor wrote leaves an empty Message,
        // and the failure under it is what there is to show. A reply still
        // arriving is not that — the caret says so.
        (content !== "" || writing) && <Prose text={content} writing={writing} />
      )}
      <Citations citations={citations} />
      {/* Under the reply and its sources, so what is taken away is the whole
          of it. A reply still being written has nothing settled to take. */}
      {!traveler && !writing && content !== "" && <CopyReply text={content} />}
      {children}
    </article>
  );
}

/**
 * The reply, taken away — into an itinerary, a note, a message to whoever else
 * is going.
 *
 * Copies the Markdown the advisor wrote rather than the text on screen, so the
 * headings and lists come back wherever it lands. The confirmation is the
 * button itself, which the traveler is already looking at; a clipboard can
 * refuse, and a button that quietly does nothing is worse than one that says so.
 */
function CopyReply({ text }: { text: string }) {
  const [said, setSaid] = useState<"copy" | "copied" | "refused">("copy");
  const settling = useRef<number | undefined>(undefined);
  // Dropped on the way out, so a press just before closing does not come back
  // to a Message that has left the page.
  useEffect(() => () => window.clearTimeout(settling.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setSaid("copied");
    } catch {
      setSaid("refused");
    }
    window.clearTimeout(settling.current);
    settling.current = window.setTimeout(() => setSaid("copy"), SAID_FOR);
  }

  const refused = said === "refused";
  const label = said === "copied" ? "Copied" : refused ? "Could not copy" : "Copy";
  return (
    // Pulled back by its own padding so the icon sits on the reply's line
    // rather than inside it. Positioned, because the Tip hangs off it.
    <div className="relative -ms-1.5 flex w-fit items-center">
      <button
        type="button"
        aria-label="Copy reply"
        className={`peer rounded-control p-1.5 pressable ${
          refused ? "text-error" : "text-ink-subtle hover:bg-sunken hover:text-ink"
        }`}
        onClick={copy}
      >
        {said === "copied" ? (
          <Check {...smallIcon} aria-hidden="true" />
        ) : (
          <Copy {...smallIcon} aria-hidden="true" />
        )}
      </button>
      <Tip label={label} refused={refused} />
      {/* Said rather than drawn: the tick confirms nothing to somebody who
          cannot see it, and nothing else changes to prove the press landed. */}
      <span role="status" className="sr-only">
        {said === "copy" ? "" : label}
      </span>
    </div>
  );
}

/** How long the button keeps saying what happened before going quiet again. */
const SAID_FOR = 2000;

/**
 * The word for an icon control, in this application's own materials.
 *
 * A native `title` is the operating system's tooltip and would be the one
 * thing on screen not out of `tokens.css`. This is cut from the same paper as
 * every other floating thing here, and arrives the way a panel does.
 *
 * Hidden from the accessibility tree — the control it belongs to is already
 * named. It answers pointer and keyboard but not touch, which is why nothing
 * here is ever said *only* in a Tip.
 */
function Tip({ label, refused = false }: { label: string; refused?: boolean }) {
  return (
    <span
      aria-hidden="true"
      // Hidden rather than faded, so each hover starts the arrival again and
      // no tooltip is left lying over the transcript.
      className={`pointer-events-none absolute bottom-full start-0 mb-1.5 hidden animate-panel whitespace-nowrap rounded-control border border-line bg-surface px-2 py-1 font-mono text-micro uppercase shadow-floating peer-hover:block peer-focus-visible:block ${
        refused ? "text-error" : "text-ink-muted"
      }`}
    >
      {label}
    </span>
  );
}
