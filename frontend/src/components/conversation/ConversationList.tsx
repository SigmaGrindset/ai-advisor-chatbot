import { useEffect, useLayoutEffect, useRef } from "react";
import { Luggage, MoreHorizontal, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

import type { ConversationSummary, TripPlan } from "../../api/types";
import { anchored } from "../shell/anchoring";
import { conversationName } from "./conversationName";
import { smallIcon } from "../../design/icons";
import { Skeleton } from "../shell/Skeleton";
import { ThemeToggle } from "../shell/ThemeToggle";
import { TripChip } from "../trip/TripChip";

/**
 * The row whose actions are showing, and whether it has been asked to delete.
 *
 * One row at a time: opening a second row's actions closes the first, so the
 * list never has two half-finished decisions in it.
 */
export type RowActions = { id: string; confirming: boolean };

export function ConversationList({
  conversations,
  resuming,
  trips,
  currentId,
  actions,
  onStart,
  onOpen,
  onActions,
  onDelete,
  onTrips,
  onInstructions,
}: {
  conversations: ConversationSummary[];
  /**
   * True until the first read has come back. An empty list is the ordinary
   * state of a first visit and it says so, which is the wrong thing to say to
   * somebody whose forty Conversations are still in flight.
   */
  resuming: boolean;
  /**
   * Every Trip the traveler has, which is what the rows are marked from. A
   * row knows the identifier of its Trip; what that Trip is called and what
   * colour it is known by are the plan's.
   */
  trips: TripPlan[];
  /** The Conversation being read, if any of them is. */
  currentId: string | null;
  /** The row whose actions are open, if one of them is. */
  actions: RowActions | null;
  onStart: () => void;
  onOpen: (id: string) => void;
  onActions: (actions: RowActions | null) => void;
  onDelete: (id: string) => void;
  /** Leave for the page that lists every Trip. */
  onTrips: () => void;
  /** Leave for the page that says how the advisor behaves. */
  onInstructions: () => void;
}) {
  const byId = new Map(trips.map((trip) => [trip.trip_id, trip]));
  return (
    <nav
      aria-label="Conversations"
      className="flex h-full min-h-0 w-full flex-col bg-sunken"
      onKeyDown={(pressed) => {
        // Escape puts a row's menu away. Handled here rather than left to the
        // browser because the panel is a `manual` popover, which is the kind
        // that has no dismissal of its own — and stopped here because inside a
        // sheet the dialog would otherwise take the same press and close the
        // whole list. One press is one thing.
        if (pressed.key === "Escape" && actions !== null) {
          pressed.stopPropagation();
          onActions(null);
        }
      }}
    >
      <div className="flex flex-col gap-4 px-4 pt-5 pb-4">
        {/* The wordmark, and no glyph beside it. A compass next to the words
            "Travel Advisor" is the picture the words already are — and it was
            drawn in the accent, which this application spends on interaction
            alone (see `tokens.css`): a mark that cannot be pressed had taken
            the one colour that means something can be. */}
        <p className="font-display text-title font-semibold tracking-tight text-ink">
          Travel Advisor
        </p>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 py-2 text-meta font-medium text-ink shadow-raised pressable hover:bg-canvas"
          onClick={onStart}
        >
          <Plus {...smallIcon} aria-hidden="true" />
          New conversation
        </button>

        {/* Navigation lives here, where the traveler already goes to move
            between things — the rail on a laptop, the left sheet everywhere
            narrower. The Trip Plan itself is never navigated to (ADR-0006);
            the two pages are the two things about no Conversation in
            particular — every Trip at once, and what the advisor is told. */}
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            className="flex items-center gap-2 rounded-control px-1 py-1 text-meta text-ink-muted pressable hover:text-ink"
            onClick={onTrips}
          >
            <Luggage {...smallIcon} aria-hidden="true" />
            All trips
          </button>

          <button
            type="button"
            className="flex items-center gap-2 rounded-control px-1 py-1 text-meta text-ink-muted pressable hover:text-ink"
            onClick={onInstructions}
          >
            <SlidersHorizontal {...smallIcon} aria-hidden="true" />
            Advisor instructions
          </button>
        </div>
      </div>

      {/* Contained, so that flicking this list past its end scrolls neither
          the transcript behind it nor the page itself. */}
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-4">
        {resuming &&
          // A row apiece, at a row's height, so the rail fills rather than
          // jumps. The widths differ because Conversation titles do, and four
          // identical bars read as a graphic rather than as a list arriving.
          LOADING_ROWS.map((width, at) => (
            <li key={at} className="px-3 py-2.5">
              <Skeleton className={`h-3.5 ${width}`} />
            </li>
          ))}

        {!resuming && conversations.length === 0 && (
          // An empty list is the ordinary state of a first visit, so it says
          // what will fill it rather than leaving the rail looking broken.
          <li className="px-3 py-2 text-meta text-ink-subtle">
            Conversations you start appear here.
          </li>
        )}

        {conversations.map((conversation) => {
          const named = conversationName(conversation.title);
          const onTrip =
            conversation.trip_id === null ? undefined : byId.get(conversation.trip_id);
          const open = conversation.id === currentId;
          const showing = actions?.id === conversation.id ? actions : null;
          return (
            <li key={conversation.id}>
              <div
                className={`flex items-center gap-1 rounded-control pr-1 pressable-row ${
                  open ? "bg-surface shadow-raised" : "hover:bg-canvas"
                }`}
              >
                <button
                  type="button"
                  aria-current={open ? "true" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-control py-2 pl-3 text-left text-meta text-ink"
                  onClick={() => onOpen(conversation.id)}
                >
                  <span className={`max-w-full truncate ${open ? "font-medium" : ""}`}>
                    {named}
                  </span>
                  {/* Which journey this Conversation is about, in that Trip's
                      own colour, so several of them about one journey read as
                      a group without being read at all. One on no Trip carries
                      nothing: every Conversation begins that way, and a rail
                      of "no trip" marks says nothing about any of them. */}
                  {onTrip !== undefined && <TripChip plan={onTrip} />}
                </button>

                <RowMenu
                  name={named}
                  panelId={`${conversation.id}-actions`}
                  showing={showing}
                  onOpen={() => onActions({ id: conversation.id, confirming: false })}
                  onConfirm={() => onActions({ id: conversation.id, confirming: true })}
                  onClose={() => onActions(null)}
                  onDelete={() => onDelete(conversation.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Below the list rather than up with the navigation, and after it in
          the document, because it is not somewhere to go — it is a setting,
          and it is the only one the application has. The list above it
          scrolls and this does not, so it stays on the floor of the rail
          however many Conversations are stacked above it. */}
      <div className="shrink-0 border-t border-line px-4 pt-3 pb-4">
        <ThemeToggle />
      </div>
    </nav>
  );
}

/**
 * What can be done to one Conversation, in a panel over the list.
 *
 * The actions live behind one permanently visible control rather than behind
 * hovering the row or swiping it. A pointer is an affordance a touch screen
 * has not got, and a swipe is one nothing tells the traveler about — and would
 * fight the sheet this list sits in on a phone besides (ADR-0007).
 *
 * What the control opens is a small panel beside it rather than more row. A
 * row that grows a second storey pushes every Conversation under it down the
 * rail, so the cost of looking at one row's actions was paid by all the others
 * — and a traveler reading the list lost their place in it to a question they
 * had not answered yet. A panel is drawn over the list and costs it nothing.
 *
 * It is a `popover`, which is the only way out of this list: the rail scrolls,
 * so a panel drawn inside it is clipped by it, and the frame the application
 * sits in is translated, so a `fixed` panel would be measured from the frame
 * rather than from the window. The browser's top layer is above and outside
 * both. `manual` rather than `auto`, because the automatic kind dismisses
 * itself on the way into a press on the very control that opened it, which
 * turns the press that should close this panel into one that closes and then
 * immediately reopens it. What that kind would have given for free — a press
 * elsewhere, Escape — is given below and by the list around it.
 */
function RowMenu({
  name,
  panelId,
  showing,
  onOpen,
  onConfirm,
  onClose,
  onDelete,
}: {
  /** What this Conversation is called, which is how the control is labelled. */
  name: string;
  /** What the panel is called, so the control can point at what it opens. */
  panelId: string;
  /** This row's actions, while they are the ones showing. */
  showing: RowActions | null;
  onOpen: () => void;
  /** Ask first. Deleting a Conversation cannot be taken back. */
  onConfirm: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Where focus goes when the panel opens, and again when what it is asking
  // changes. `autofocus` cannot do it: the browser applies that while the
  // panel is still `display: none`, which is to say it does not apply it.
  const landing = useRef<HTMLButtonElement>(null);
  // The way out, kept where a listener registered once can still read the
  // current one: closing is the list's to do, and the list hands down a new
  // function every render.
  const close = useRef(onClose);
  const open = showing !== null;
  const confirming = showing?.confirming ?? false;

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Shown, placed, and handed the focus — all before the frame it was opened
  // in is painted, which is what makes this a layout effect. An ordinary one
  // would let the browser paint the panel once where it parks a popover that
  // has not been told where it goes, which is the middle of the window.
  useLayoutEffect(() => {
    const menu = panel.current;
    const control = trigger.current;
    if (menu === null || control === null) return;

    if (!menu.matches(":popover-open")) menu.showPopover();
    const place = anchored(control.getBoundingClientRect(), menu.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    menu.style.top = `${place.top}px`;
    menu.style.left = `${place.left}px`;
    landing.current?.focus();
  }, [open, confirming]);

  // What puts it away: a press anywhere else, and anything that moves the row
  // out from under it. The panel is in the top layer and the row is not, so a
  // rail scrolled while this is open would leave the panel hanging over a
  // Conversation it is not about. It is closed rather than followed, because a
  // menu chasing a scrolling row is a menu nobody can hit.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = panel.current;

    const away = () => close.current();
    const pressed = (event: PointerEvent) => {
      const at = event.target as Node | null;
      if (at === null) return;
      // The control itself is not "elsewhere". Pressing it again is how the
      // panel is closed, and closing it here as well would leave that press
      // with nothing left to close and a panel that opens straight back up.
      if (menu?.contains(at) === true || trigger.current?.contains(at) === true) return;
      close.current();
    };

    const scrolled = (event: Event) => {
      // Only a scroll that takes this row with it. The transcript scrolls
      // itself every time the advisor writes another line, and a menu the
      // traveler opened should not be closed by something happening in
      // another pane.
      const what = event.target as Node | null;
      if (what === null || what.contains(trigger.current)) close.current();
    };

    document.addEventListener("pointerdown", pressed, true);
    window.addEventListener("resize", away);
    // Captured, because what scrolls is the list this row is in, and a scroll
    // does not bubble as far as the window.
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", scrolled, true);
      // The panel has gone from the page and the browser has dropped focus on
      // the floor with it. Put focus back on the control that opened it —
      // unless the traveler has already put it somewhere themselves, which is
      // what a press on something else was.
      if (document.activeElement === document.body) trigger.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="shrink-0 rounded-control p-2 text-ink-subtle transition-colors hover:text-ink"
        onClick={() => (open ? onClose() : onOpen())}
      >
        <MoreHorizontal {...smallIcon} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          popover="manual"
          role="group"
          aria-label={`Actions for ${name}`}
          // A sheet of paper laid over the list: opaque, its own hairline, and
          // the one shadow in the system that says something is floating
          // rather than merely raised. `inset-auto` and `m-0` undo what a
          // browser gives a popover of its own accord, which is a panel
          // centred in the window; the corner it actually goes in is measured
          // and set above.
          className="fixed inset-auto m-0 w-max min-w-44 max-w-64 rounded-panel border border-line bg-surface p-1 text-meta shadow-floating"
        >
          {confirming ? (
            <div className="flex flex-col gap-1">
              <p className="px-2 pt-1 font-mono text-micro uppercase text-ink-subtle">
                Delete this conversation?
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="flex-1 rounded-control px-2 py-1.5 font-medium text-error pressable-row hover:bg-error-tint"
                  onClick={onDelete}
                >
                  Delete
                </button>
                {/* Focus lands on this one rather than on the delete beside
                    it. The question is only being asked because deleting
                    cannot be taken back, and a question asked for that reason
                    should answer itself the safe way for whoever presses the
                    key they were already pressing. */}
                <button
                  ref={landing}
                  type="button"
                  className="flex-1 rounded-control px-2 py-1.5 text-ink-muted pressable-row hover:bg-sunken hover:text-ink"
                  onClick={onClose}
                >
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={landing}
              type="button"
              className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-ink pressable-row hover:bg-sunken hover:text-error"
              onClick={onConfirm}
            >
              <Trash2 {...smallIcon} aria-hidden="true" />
              Delete conversation
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** The widths the rail stands in at, one per row it is waiting for. */
const LOADING_ROWS = ["w-4/5", "w-3/5", "w-11/12", "w-2/3"] as const;
