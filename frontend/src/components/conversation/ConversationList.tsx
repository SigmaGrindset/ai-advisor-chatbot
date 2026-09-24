import { useLayoutEffect, useRef, useState } from "react";
import {
  Luggage,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import type { ConversationSummary, TripPlan } from "../../api/types";
import { AccountControls } from "../account/AccountControls";
import { useAnchoredPanel } from "../shell/anchoredPanel";
import { conversationName, MAX_NAME } from "./conversationName";
import { smallIcon } from "../../design/icons";
import { Skeleton } from "../shell/Skeleton";
import { ThemeToggle } from "../shell/ThemeToggle";
import { TripChip } from "../trip/TripChip";

/**
 * The row whose actions are showing, and whether it has been asked to delete.
 * One row at a time, so the list never holds two half-finished decisions.
 */
export type RowActions = { id: string; confirming: boolean };

export function ConversationList({
  conversations,
  resuming,
  trips,
  currentId,
  actions,
  renaming,
  onStart,
  onOpen,
  onActions,
  onRenaming,
  onRename,
  onDelete,
  onTrips,
  onInstructions,
  signingIn,
}: {
  conversations: ConversationSummary[];
  /**
   * True until the first read has come back. The empty state says what will
   * fill the list, which is the wrong thing to say to somebody whose forty
   * Conversations are still in flight.
   */
  resuming: boolean;
  /** What the rows are marked from: a row knows only its Trip's identifier. */
  trips: TripPlan[];
  currentId: string | null;
  actions: RowActions | null;
  renaming: string | null;
  onStart: () => void;
  onOpen: (id: string) => void;
  onActions: (actions: RowActions | null) => void;
  /** Put a row's name under a cursor, or take it back out again. */
  onRenaming: (id: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTrips: () => void;
  onInstructions: () => void;
  /** Whether there is anywhere to sign in: not without Clerk. */
  signingIn: boolean;
}) {
  const byId = new Map(trips.map((trip) => [trip.trip_id, trip]));
  return (
    <nav
      aria-label="Conversations"
      className="flex h-full min-h-0 w-full flex-col bg-sunken"
      onKeyDown={(pressed) => {
        // A `manual` popover has no dismissal of its own, and the press is
        // stopped so the sheet around it does not also close. One press is
        // one thing.
        if (pressed.key === "Escape" && actions !== null) {
          pressed.stopPropagation();
          onActions(null);
        }
      }}
    >
      <div className="flex flex-col gap-4 px-4 pt-5 pb-4">
        {/* The wordmark, and no glyph beside it: the accent is spent on
            interaction alone (`tokens.css`), and a mark that cannot be pressed
            had taken the one colour that means something can be. */}
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

        {/* Navigation lives where the traveler already goes to move between
            things. The Trip Plan itself is never navigated to. */}
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

      {/* Contained, so flicking past the end scrolls neither the transcript
          behind it nor the page. */}
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-4">
        {resuming &&
          // At a row's height, so the rail fills rather than jumps. The widths
          // differ because titles do: identical bars read as a graphic.
          LOADING_ROWS.map((width, at) => (
            <li key={at} className="px-3 py-2.5">
              <Skeleton className={`h-3.5 ${width}`} />
            </li>
          ))}

        {!resuming && conversations.length === 0 && (
          // Says what will fill it, rather than leaving the rail looking broken.
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
          const editing = conversation.id === renaming;
          return (
            <li key={conversation.id}>
              <div
                className={`flex items-center gap-1 rounded-control pr-1 ${
                  // Raised like the open row but with no give under a press:
                  // a click into its own text field is not aimed at the row.
                  editing
                    ? "bg-surface shadow-raised"
                    : `pressable-row ${open ? "bg-surface shadow-raised" : "hover:bg-canvas"}`
                }`}
              >
                {editing ? (
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 py-1.5 pl-3">
                    <RenameField
                      title={conversation.title}
                      name={named}
                      onRename={(chosen) => onRename(conversation.id, chosen)}
                      onClose={() => onRenaming(null)}
                    />
                    {onTrip !== undefined && <TripChip plan={onTrip} />}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-current={open ? "true" : undefined}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-control py-2 pl-3 text-left text-meta text-ink"
                    onClick={() => onOpen(conversation.id)}
                  >
                    <span className={`max-w-full truncate ${open ? "font-medium" : ""}`}>
                      {named}
                    </span>
                    {/* In that Trip's colour, so several about one journey read
                        as a group without being read. One on no Trip carries
                        nothing: every Conversation begins that way. */}
                    {onTrip !== undefined && <TripChip plan={onTrip} />}
                  </button>
                )}

                <RowMenu
                  name={named}
                  panelId={`${conversation.id}-actions`}
                  showing={showing}
                  onOpen={() => onActions({ id: conversation.id, confirming: false })}
                  onConfirm={() => onActions({ id: conversation.id, confirming: true })}
                  onClose={() => onActions(null)}
                  onRename={() => {
                    // What the panel asked for happens in the row itself.
                    onActions(null);
                    onRenaming(conversation.id);
                  }}
                  onDelete={() => onDelete(conversation.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Below the navigation and after it in the document: who is signed in
          and the theme are settings rather than somewhere to go. It does not
          scroll with the list. */}
      <div className="flex shrink-0 flex-col items-start gap-3 border-t border-line px-4 pt-3 pb-4">
        {signingIn && <AccountControls />}
        <ThemeToggle />
      </div>
    </nav>
  );
}

/**
 * What can be done to one Conversation, in a panel over the list.
 *
 * Behind a permanently visible control rather than hover or swipe: a touch
 * screen has no pointer, and a swipe would fight the sheet this sits in on a
 * phone. A panel rather than a second storey on the row, which
 * would push every Conversation under it down the rail.
 *
 * It is a `popover` because the rail scrolls (so a panel inside is clipped)
 * and the frame is translated (so `fixed` measures from the frame). Placement
 * and focus are `shell/anchoredPanel`; Escape is the list's, above.
 */
function RowMenu({
  name,
  panelId,
  showing,
  onOpen,
  onConfirm,
  onClose,
  onRename,
  onDelete,
}: {
  name: string;
  panelId: string;
  /** This row's actions, while they are the ones showing. */
  showing: RowActions | null;
  onOpen: () => void;
  /** Ask first. Deleting a Conversation cannot be taken back. */
  onConfirm: () => void;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const open = showing !== null;
  const confirming = showing?.confirming ?? false;
  const { trigger, panel, landing } = useAnchoredPanel({
    open,
    // The two questions are different sizes, so each gets its own placement
    // and focus.
    showing: confirming,
    onClose,
  });

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
          // `inset-auto` and `m-0` undo the browser's own centring; the corner
          // it actually goes in is measured and set above.
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
                {/* Focus lands here rather than on Delete: a question asked
                    because it cannot be taken back should answer itself the
                    safe way. */}
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
            // Named by what they do and nothing else: the panel already says
            // whose actions these are.
            <div className="flex flex-col gap-0.5">
              <button
                ref={landing}
                type="button"
                className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-ink pressable-row hover:bg-sunken"
                onClick={onRename}
              >
                <Pencil {...smallIcon} aria-hidden="true" />
                Rename
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-ink pressable-row hover:bg-sunken hover:text-error"
                onClick={onConfirm}
              >
                <Trash2 {...smallIcon} aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * A Conversation's name in the list, while the traveler is changing it. The
 * row's own title becomes the field rather than a dialog opening elsewhere.
 *
 * Blur saves, Enter saves, Escape cancels — the same three as every editable
 * part of the Trip Plan (`plan/EditableField.tsx`).
 */
function RenameField({
  title,
  name,
  onRename,
  onClose,
}: {
  /** Null for a Conversation nothing has named yet. */
  title: string | null;
  /** What it is called in the list, which an unnamed one's field stands in as. */
  name: string;
  onRename: (title: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(title ?? "");
  const field = useRef<HTMLInputElement>(null);
  // A handler running after this closed still has to read it, and state
  // cannot answer: it closed over the render before the one that closed it.
  const open = useRef(true);

  // A layout effect, because the panel pressed to get here puts focus back on
  // its own trigger as it goes: an ordinary effect would land after that.
  useLayoutEffect(() => {
    field.current?.focus();
    // Selected, since renaming something already named usually replaces it.
    field.current?.setSelectionRange(0, field.current.value.length, "backward");
    // Wound back to the first word: focusing a field whose text overflows it
    // scrolls to the end, which is not what they pressed Rename beside.
    if (field.current !== null) field.current.scrollLeft = 0;
  }, []);

  function stop(saving: boolean) {
    if (!open.current) return;
    open.current = false;
    const chosen = draft.trim();
    onClose();
    // Nothing is not a name: a field cleared to empty leaves the name it had,
    // and leaves an unnamed one for the advisor to name after the next exchange.
    if (saving && chosen !== "" && chosen !== title) onRename(chosen);
  }

  return (
    <input
      ref={field}
      type="text"
      aria-label={`Rename ${name}`}
      value={draft}
      placeholder={name}
      maxLength={MAX_NAME}
      onChange={(typed) => setDraft(typed.target.value)}
      onBlur={() => stop(true)}
      onKeyDown={(pressed) => {
        if (pressed.key === "Enter") stop(true);
        else if (pressed.key === "Escape") {
          // Not the sheet's Escape, and not the list's. One press is one thing.
          pressed.preventDefault();
          pressed.stopPropagation();
          stop(false);
        }
      }}
      // At the size everything typed into is set at, not the row's smaller
      // one: iOS zooms the page for a focused field under 16px.
      className="w-full min-w-0 rounded-control border border-line-strong bg-surface px-1.5 py-0.5 text-input text-ink outline-none placeholder:text-ink-subtle focus:outline-2 focus:outline-offset-1 focus:outline-focus"
    />
  );
}

/** The widths the rail stands in at, one per row it is waiting for. */
const LOADING_ROWS = ["w-4/5", "w-3/5", "w-11/12", "w-2/3"] as const;
