import { useState } from "react";
import { ArrowLeft, CalendarDays, HelpCircle, MessagesSquare, Trash2 } from "lucide-react";

import type { ConversationSummary, TripPlan } from "../api/types";
import { conversationName } from "../components/conversation/conversationName";
import { icon, smallIcon } from "../design/icons";
import { nights, showRange } from "../components/plan/dates";
import { showAmount } from "../components/plan/money";
import { gathered } from "../components/trip/listing";
import { useAnchoredPanel } from "../components/shell/anchoredPanel";
import { tripName } from "../components/trip/naming";
import { useTheme } from "../design/theme";
import { tripPastel } from "../design/tripPastel";

/**
 * Every Trip the traveler is planning, in one place.
 *
 * The Trip Plan is not a page — it belongs beside the Conversation producing
 * it (ADR-0006) — but the *set* of Trips is, because it is the one thing in
 * this application that is about none of the open Conversations in
 * particular. It is where a traveler planning two journeys at once finds out
 * that they are, and which Conversations went where.
 *
 * Each Trip is shown with what its plan holds and the Conversations refining
 * it, because that is what makes several Conversations about one journey read
 * as a group rather than as a list that happens to repeat a word. The ones on
 * no Trip are shown at the foot under a heading of their own: every
 * Conversation starts there, and one the advisor has not placed is not a Trip
 * of one.
 *
 * It is also the only place a Trip can be deleted, for the same reason: what
 * a traveler is deciding when they delete one is which journeys they are
 * still planning, and that is a question about all of them at once. A control
 * for it beside the plan — which is beside a Conversation — would ask it in
 * the middle of the answer.
 */
export function TripsPage({
  trips,
  conversations,
  currentId,
  failure,
  onOpen,
  onDelete,
  onBack,
}: {
  trips: TripPlan[];
  conversations: ConversationSummary[];
  /** The Conversation being read, which is marked wherever it is listed. */
  currentId: string | null;
  /**
   * What went wrong here, if something did. Deleting a Trip is the one thing
   * this page does rather than shows, so it is the one thing that can fail on
   * it — and a deletion that quietly did not happen is worse than one that
   * says so, because the trip is still on the page either way.
   */
  failure: string | null;
  /** Open a Conversation, which is also the way back to it. */
  onOpen: (id: string) => void;
  /** Delete a Trip, and what the traveler decided about its Conversations. */
  onDelete: (tripId: string, conversations: OnDeletingTrip) => void;
  onBack: () => void;
}) {
  const { trips: gatherings, unattached } = gathered(trips, conversations);
  // The Trip whose deletion is being confirmed, if one is. One at a time: a
  // page with two open questions on it is a page with two half-made decisions.
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-w-0 flex-1 flex-col outline-none"
      onKeyDown={(pressed) => {
        // Escape puts the question away, the same as it does over the
        // Conversation list. The panel is a `manual` popover, which is the
        // kind with no dismissal of its own.
        if (pressed.key === "Escape" && confirming !== null) {
          pressed.stopPropagation();
          setConfirming(null);
        }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-control p-2 text-meta text-ink-muted pressable hover:bg-sunken hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft {...icon} aria-hidden="true" />
          Conversations
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-reading flex-col gap-8">
          <h1 className="font-display text-display text-balance text-ink sm:text-page">Your trips</h1>

          {failure !== null && (
            <p role="alert" className="text-meta text-error">
              {failure}
            </p>
          )}

          {gatherings.length === 0 ? (
            <p className="text-meta text-ink-subtle">
              A trip appears here as soon as a conversation records something about one —
              where you are going, when, or what you want to do.
            </p>
          ) : (
            <ul className="flex flex-col border-b border-line">
              {gatherings.map(({ plan, conversations: refining }) => (
                <li key={plan.trip_id}>
                  <Trip
                    plan={plan}
                    conversations={refining}
                    currentId={currentId}
                    onOpen={onOpen}
                    confirming={confirming === plan.trip_id}
                    onConfirm={() =>
                      setConfirming(confirming === plan.trip_id ? null : plan.trip_id)
                    }
                    onClose={() => setConfirming(null)}
                    onDelete={(keeping) => {
                      setConfirming(null);
                      onDelete(plan.trip_id, keeping);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {unattached.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-micro uppercase text-ink-subtle">Not on a trip</h2>
              <p className="text-meta text-ink-subtle">
                These conversations are about no journey in particular yet. Put one on a trip
                from the switcher above its plan.
              </p>
              <Conversations
                conversations={unattached}
                currentId={currentId}
                onOpen={onOpen}
              />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

/** One Trip: what its plan says, and the Conversations that have written it. */
function Trip({
  plan,
  conversations,
  currentId,
  onOpen,
  confirming,
  onConfirm,
  onClose,
  onDelete,
}: {
  plan: TripPlan;
  conversations: ConversationSummary[];
  currentId: string | null;
  onOpen: (id: string) => void;
  /** True while this is the Trip the page is asking about. */
  confirming: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onDelete: (conversations: OnDeletingTrip) => void;
}) {
  const running = nights(plan.starts_on, plan.ends_on);
  const { scheme } = useTheme();
  return (
    // A rule and room, not a box. A Trip is a heading with things under it —
    // its facts, then the Conversations writing them — and a border drawn
    // round that says only that it ends, which the next heading says anyway.
    // The white fill said even less: on this canvas the two are a shade
    // apart, so the card was a hairline pretending to be a surface.
    <article className="flex flex-col gap-3 border-t border-line pt-6 pb-7">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2.5 font-display text-title font-semibold text-ink">
          {/* The Trip's own colour, which is what its chip is drawn in wherever
              a Conversation mentions it. Said in a swatch rather than a second
              chip, because a heading that repeats itself in two type sizes is
              not two facts. Squared off rather than round: the chip is the pill
              in this application, and a second pill at a third the size reads
              as a small chip rather than as a mark. */}
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-[3px]"
            style={{ backgroundColor: tripPastel(plan.trip_id, scheme).border }}
          />
          <span className="min-w-0 truncate">{tripName(plan)}</span>
        </h2>
        <DeleteTrip
          name={tripName(plan)}
          panelId={`delete-${plan.trip_id}`}
          refining={conversations.length}
          confirming={confirming}
          onConfirm={onConfirm}
          onClose={onClose}
          onDelete={onDelete}
        />
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-meta">
        <Fact label="Dates">
          {showRange(plan.starts_on, plan.ends_on) ?? "Not decided"}
          {running !== null && <span className="text-ink-subtle"> · {running} days</span>}
        </Fact>
        <Fact label="Party">
          {plan.party_size === null ? "Not decided" : `${plan.party_size} travelling`}
        </Fact>
        <Fact label="Budget">
          {plan.budget_amount === null
            ? "Not decided"
            : `${showAmount(plan.budget_amount)} ${plan.budget_currency ?? ""}`.trim()}
        </Fact>
      </dl>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-subtle">
        <span className="flex items-center gap-1.5">
          <CalendarDays {...smallIcon} aria-hidden="true" />
          {counted(plan.items.length, "itinerary item")}
        </span>
        <span className="flex items-center gap-1.5">
          <HelpCircle {...smallIcon} aria-hidden="true" />
          {counted(plan.questions.length, "open question")}
        </span>
      </p>

      {conversations.length === 0 ? (
        <p className="text-meta text-ink-subtle">
          No conversation is refining this trip at the moment.
        </p>
      ) : (
        <Conversations
          conversations={conversations}
          currentId={currentId}
          onOpen={onOpen}
        />
      )}
    </article>
  );
}

/** What the traveler decides about a Trip's Conversations when the Trip goes. */
export type OnDeletingTrip = "keep" | "delete";

/**
 * Deleting a Trip, and the one question that has to be asked first.
 *
 * Two things go without asking, because they are not attached to the plan —
 * they *are* the plan: the Itinerary Items and the Open Questions. The
 * Conversations are the question. A traveler deleting a trip they have given
 * up on may well want the talk that went into it gone too, and a traveler
 * tidying a journey they recorded twice certainly does not — and neither
 * answer can be guessed from the gesture, because both are the same gesture.
 *
 * So it is a checkbox rather than two buttons or two menu items: one decision
 * is being made, with a detail attached to it, and the detail is easier to
 * read as a sentence that is either true or false than as a second verb. It
 * starts unticked, and the line under it says what each answer means —
 * including that a kept Conversation is still a live one, and will start a
 * fresh plan the next time the advisor records something about a journey in
 * it. That is a surprise worth spending a line on here rather than leaving
 * the traveler to meet two messages later.
 */
function DeleteTrip({
  name,
  panelId,
  refining,
  confirming,
  onConfirm,
  onClose,
  onDelete,
}: {
  /** What this Trip is called, which is how the control is labelled. */
  name: string;
  /** What the panel is called, so the control can point at what it opens. */
  panelId: string;
  /** How many Conversations are on this Trip, which is what is at stake. */
  refining: number;
  confirming: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onDelete: (conversations: OnDeletingTrip) => void;
}) {
  // Unticked every time the question is asked, because it unmounts with the
  // panel. Keeping a decision the traveler made about a different Trip, or
  // about this one a minute ago, would be an answer they did not give.
  const [going, setGoing] = useState(false);
  const { trigger, panel, landing } = useAnchoredPanel({
    open: confirming,
    // The panel grows a line when the checkbox changes what it says, so it is
    // measured and placed again for the size it now is.
    showing: going,
    onClose,
  });

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Delete ${name}`}
        aria-expanded={confirming}
        aria-controls={confirming ? panelId : undefined}
        className="shrink-0 rounded-control p-2 text-ink-subtle transition-colors hover:text-error"
        onClick={onConfirm}
      >
        <Trash2 {...smallIcon} aria-hidden="true" />
      </button>

      {confirming && (
        <div
          ref={panel}
          id={panelId}
          popover="manual"
          role="group"
          aria-label={`Delete ${name}`}
          // The same sheet of paper the Conversation list lays over itself.
          // `inset-auto` and `m-0` undo what a browser gives a popover of its
          // own accord, which is a panel centred in the window; the corner it
          // actually goes in is measured by `anchoredPanel`.
          //
          // One fixed width rather than one measured from the words in it. The
          // line under the checkbox says a different thing for each answer, so
          // a panel sized to its contents would change width under the cursor
          // at the moment of the tick — the traveler would have moved the
          // thing they were reading by reading it.
          className="fixed inset-auto m-0 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-panel border border-line bg-surface p-1 text-meta shadow-floating"
        >
          <p className="px-2 pt-1 font-mono text-micro uppercase text-ink-subtle">
            Delete this trip?
          </p>

          {refining > 0 && (
            <>
              {/* A label wrapping its own control, so the words are as
                  pressable as the box — a target this small asked for on a
                  phone is a target nobody hits (ADR-0007). */}
              <label className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-ink hover:bg-sunken">
                <input
                  type="checkbox"
                  checked={going}
                  onChange={(changed) => setGoing(changed.target.checked)}
                  className="size-3.5 shrink-0 cursor-pointer accent-accent"
                />
                Delete its {counted(refining, "conversation")} too
              </label>
              {/* Said of one Conversation or of several, because a trip has
                  either and "them" about a single thread is a sentence
                  written for the common case rather than for this one. */}
              <p className="px-2 pb-1 text-micro text-ink-subtle">
                {going
                  ? `Everything said in ${refining === 1 ? "it" : "them"} goes with the plan.`
                  : refining === 1
                    ? "It stays, and will begin a new plan if you keep talking in it."
                    : "They stay, and will begin a new plan if you keep talking in them."}
              </p>
            </>
          )}

          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 rounded-control px-2 py-1.5 font-medium text-error pressable-row hover:bg-error-tint"
              onClick={() => onDelete(going ? "delete" : "keep")}
            >
              Delete
            </button>
            {/* Focus lands here rather than on the delete beside it, and on
                the checkbox above it. The question is only being asked
                because deleting cannot be taken back, and a question asked
                for that reason should answer itself the safe way for whoever
                presses the key they were already pressing. */}
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
      )}
    </>
  );
}

/** The Conversations under a heading, each a way back into them. */
function Conversations({
  conversations,
  currentId,
  onOpen,
}: {
  conversations: ConversationSummary[];
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {conversations.map((conversation) => {
        const open = conversation.id === currentId;
        return (
          <li key={conversation.id} className="flex">
            <button
              type="button"
              aria-current={open ? "true" : undefined}
              className="flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-left text-meta text-ink pressable-row hover:bg-sunken"
              onClick={() => onOpen(conversation.id)}
            >
              <MessagesSquare
                {...smallIcon}
                className="shrink-0 text-ink-subtle"
                aria-hidden="true"
              />
              <span className={`min-w-0 truncate ${open ? "font-medium" : ""}`}>
                {conversationName(conversation.title)}
              </span>
              {open && (
                <span className="shrink-0 font-mono text-micro text-ink-subtle">open</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One thing the plan says, or that it has not been told yet. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="font-mono text-micro uppercase text-ink-subtle">{label}</dt>
      <dd className="truncate text-ink">{children}</dd>
    </div>
  );
}

/** "3 open questions", and "1 open question" — plurals a traveler would say. */
function counted(many: number, thing: string): string {
  return `${many} ${thing}${many === 1 ? "" : "s"}`;
}
