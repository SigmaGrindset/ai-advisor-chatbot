import { ArrowLeft, CalendarDays, HelpCircle, MessagesSquare } from "lucide-react";

import type { ConversationSummary, TripPlan } from "../api/types";
import { conversationName } from "../components/conversation/conversationName";
import { icon, smallIcon } from "../design/icons";
import { nights, showRange } from "../components/plan/dates";
import { showAmount } from "../components/plan/money";
import { gathered } from "../components/trip/listing";
import { tripName } from "../components/trip/naming";
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
 */
export function TripsPage({
  trips,
  conversations,
  currentId,
  onOpen,
  onBack,
}: {
  trips: TripPlan[];
  conversations: ConversationSummary[];
  /** The Conversation being read, which is marked wherever it is listed. */
  currentId: string | null;
  /** Open a Conversation, which is also the way back to it. */
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const { trips: gatherings, unattached } = gathered(trips, conversations);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-control p-2 text-meta text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft {...icon} aria-hidden="true" />
          Conversations
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-reading flex-col gap-8">
          <h1 className="font-display text-display text-ink">Your trips</h1>

          {gatherings.length === 0 ? (
            <p className="text-meta text-ink-subtle">
              A trip appears here as soon as a conversation records something about one —
              where you are going, when, or what you want to do.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {gatherings.map(({ plan, conversations: refining }) => (
                <li key={plan.trip_id}>
                  <Trip
                    plan={plan}
                    conversations={refining}
                    currentId={currentId}
                    onOpen={onOpen}
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
    </div>
  );
}

/** One Trip: what its plan says, and the Conversations that have written it. */
function Trip({
  plan,
  conversations,
  currentId,
  onOpen,
}: {
  plan: TripPlan;
  conversations: ConversationSummary[];
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  const running = nights(plan.starts_on, plan.ends_on);
  return (
    <article className="flex flex-col gap-3 rounded-panel border border-line bg-surface px-4 py-4">
      <h2 className="flex min-w-0 items-center gap-2 font-display text-title font-semibold text-ink">
        {/* The Trip's own colour, which is what its chip is drawn in wherever
            a Conversation mentions it. Said in a swatch rather than a second
            chip, because a heading that repeats itself in two type sizes is
            not two facts. */}
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-chip"
          style={{ backgroundColor: tripPastel(plan.trip_id).border }}
        />
        <span className="min-w-0 truncate">{tripName(plan)}</span>
      </h2>

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
              className="flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-left text-meta text-ink transition-colors hover:bg-sunken"
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
