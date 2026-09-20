import { useState } from "react";
import { HelpCircle, Plus, X } from "lucide-react";

import type { ItineraryItem, TripPlan } from "../../api/types";
import { nights, showDate, showDay } from "./dates";
import { EditableField } from "./EditableField";
import { showAmount } from "./money";
import { smallIcon } from "../../design/icons";
import { Skeleton } from "../shell/Skeleton";
import { valueOf } from "./fields";

/**
 * The Trip Plan, drawn. It draws nothing around itself — the tab strip and
 * heading are the record pane's, and where the pane goes is the shell's.
 *
 * Every value is the traveler's to change and says so permanently rather than
 * on hover (ADR-0007). What the advisor changed a moment ago is lit and
 * fading, so a plan moving while they read it says which part moved.
 */
export function PlanPanel({
  plan,
  resuming,
  lit,
  suggestions,
  onEditing,
  onSave,
  onDismiss,
  onAdd,
  onRemove,
  onAsk,
  onSettle,
}: {
  /** The plan on screen, and null while the Conversation is refining none. */
  plan: TripPlan | null;
  /**
   * True until the first read has come back. A plan that has not arrived and
   * a Conversation that is about no trip are both null here, and only the
   * second of them is the sentence below.
   */
  resuming: boolean;
  /** The fields the advisor changed a moment ago. */
  lit: ReadonlySet<string>;
  /** What the advisor wanted for a field the traveler had open, by field. */
  suggestions: Record<string, string>;
  onEditing: (field: string | null) => void;
  /** Save one field — a scalar by name, an Itinerary Item by its identifier. */
  onSave: (field: string, value: string) => void;
  onDismiss: (field: string) => void;
  onAdd: (day: number, description: string) => void;
  onRemove: (itemId: string) => void;
  /** Compose a message pursuing this Open Question, without sending it. */
  onAsk: (question: string) => void;
  onSettle: (questionId: string) => void;
}) {
  if (resuming) {
    // The shape of a plan's head: the destination at a masthead's height,
    // then a label and a value on each line below.
    return (
      <div className="flex flex-col gap-7" role="status" aria-label="Loading the trip plan">
        <div className="border-b border-line pb-5">
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="flex flex-col gap-3">
          {LOADING_ROWS.map((width, at) => (
            <div key={at} className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className={`h-3.5 ${width}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (plan === null) {
    return (
      <p className="text-meta text-ink-subtle">
        A trip takes shape here as you talk about one — destination, dates, the days
        themselves and what is still undecided, all of it yours to change.
      </p>
    );
  }

  const field = (name: string) => ({
    field: name,
    value: valueOf(plan, name) ?? "",
    lit: lit.has(name),
    suggestion: suggestions[name] ?? null,
    onEditing,
    onSave: (value: string) => onSave(name, value),
    onDismiss: () => onDismiss(name),
  });

  const running = nights(plan.starts_on, plan.ends_on);

  return (
    <div className="flex flex-col gap-7">
      {/* The destination is the trip's name rather than a fact about it, and
          is what a traveler opens this pane looking for — so it is the same
          field as the rest, set larger and given a rule to sit on.
          The chip in the switcher above carries the same word but answers a
          different question: which Trip this Conversation is on. */}
      <div className="border-b border-line pb-5">
        <EditableField
          {...field("destination")}
          label="Destination"
          size="display"
          align="left"
          shown={plan.destination ?? ""}
          placeholder="Where to?"
        />
      </div>

      <dl className="flex flex-col gap-3">
        <Row label="Dates" note={running === null ? null : `${running} days`}>
          <div className="flex min-w-0 flex-col items-end gap-1">
            <EditableField
              {...field("starts_on")}
              label="First day"
              kind="date"
              shown={showDate(plan.starts_on) ?? ""}
              placeholder="First day"
            />
            <EditableField
              {...field("ends_on")}
              label="Last day"
              kind="date"
              shown={showDate(plan.ends_on) ?? ""}
              placeholder="Last day"
            />
          </div>
        </Row>

        <Row label="Party">
          <EditableField
            {...field("party_size")}
            label="Party size"
            kind="number"
            shown={plan.party_size === null ? "" : `${plan.party_size} travelling`}
            placeholder="How many?"
          />
        </Row>

        <Row label="Budget">
          <div className="flex min-w-0 items-baseline justify-end gap-2">
            <EditableField
              {...field("budget_amount")}
              label="Budget"
              kind="number"
              shown={plan.budget_amount === null ? "" : showAmount(plan.budget_amount)}
              placeholder="How much?"
            />
            <EditableField
              {...field("budget_currency")}
              label="Budget currency"
              shown={plan.budget_currency ?? ""}
              placeholder="CUR"
            />
          </div>
        </Row>
      </dl>

      <Itinerary
        plan={plan}
        lit={lit}
        suggestions={suggestions}
        onEditing={onEditing}
        onSave={onSave}
        onDismiss={onDismiss}
        onAdd={onAdd}
        onRemove={onRemove}
      />

      <Questions plan={plan} lit={lit} onAsk={onAsk} onSettle={onSettle} />
    </div>
  );
}

/** One labelled line of the plan. */
function Row({
  label,
  note = null,
  children,
}: {
  label: string;
  /** Something the plan works out rather than holds — how long the trip runs. */
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 font-mono text-micro uppercase text-ink-subtle">
        {label}
        {note !== null && <span className="ml-2 normal-case text-ink-subtle">· {note}</span>}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The rough shape of the days, grouped by the day they fall on. */
function Itinerary({
  plan,
  lit,
  suggestions,
  onEditing,
  onSave,
  onDismiss,
  onAdd,
  onRemove,
}: {
  plan: TripPlan;
  lit: ReadonlySet<string>;
  suggestions: Record<string, string>;
  onEditing: (field: string | null) => void;
  onSave: (field: string, value: string) => void;
  onDismiss: (field: string) => void;
  onAdd: (day: number, description: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const days = [...new Set(plan.items.map((item) => item.day))].sort((a, b) => a - b);
  const next = (days[days.length - 1] ?? 0) + 1;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-mono text-micro uppercase text-ink-subtle">Itinerary</h3>

      {days.length === 0 ? (
        <p className="text-meta text-ink-subtle">
          Nothing is planned into a day yet. Talk about what you want to do, or add
          something yourself.
        </p>
      ) : (
        days.map((day) => (
          <div key={day} className="flex flex-col gap-1.5">
            <h4 className="flex items-baseline gap-2 text-meta font-medium text-ink">
              Day {day}
              <span className="font-mono text-micro text-ink-subtle">
                {showDay(day, plan.starts_on) ?? ""}
              </span>
            </h4>
            <ul className="flex flex-col gap-1.5">
              {plan.items
                .filter((item) => item.day === day)
                .map((item) => (
                  <Entry
                    key={item.id}
                    item={item}
                    lit={lit.has(item.id)}
                    suggestion={suggestions[item.id] ?? null}
                    onEditing={onEditing}
                    onSave={(value) => onSave(item.id, value)}
                    onDismiss={() => onDismiss(item.id)}
                    onRemove={() => onRemove(item.id)}
                  />
                ))}
            </ul>
            <AddItem label={`Add to day ${day}`} onAdd={(what) => onAdd(day, what)} />
          </div>
        ))
      )}

      <AddItem
        label={days.length === 0 ? "Add something to day 1" : `Add day ${next}`}
        onAdd={(what) => onAdd(days.length === 0 ? 1 : next, what)}
      />
    </section>
  );
}

/** One Itinerary Item: what it is, roughly when, and the way to take it off. */
function Entry({
  item,
  lit,
  suggestion,
  onEditing,
  onSave,
  onDismiss,
  onRemove,
}: {
  item: ItineraryItem;
  lit: boolean;
  suggestion: string | null;
  onEditing: (field: string | null) => void;
  onSave: (value: string) => void;
  onDismiss: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {item.part_of_day !== null && (
          <span className="font-mono text-micro uppercase text-ink-subtle">
            {item.part_of_day}
          </span>
        )}
        <div className="flex min-w-0">
          <EditableField
            field={item.id}
            label="Itinerary item"
            align="left"
            value={item.description}
            shown={item.description}
            placeholder="What happens?"
            lit={lit}
            suggestion={suggestion}
            onEditing={onEditing}
            onSave={onSave}
            onDismiss={onDismiss}
          />
        </div>
      </div>
      <button
        type="button"
        aria-label={`Remove ${item.description}`}
        className="shrink-0 rounded-control p-1 text-ink-subtle pressable hover:bg-sunken hover:text-ink"
        onClick={onRemove}
      >
        <X {...smallIcon} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Adding something to a day.
 *
 * The control opens a field rather than creating an empty row, because an
 * Itinerary Item with nothing in it is a record of nothing — and Escape has
 * to leave the plan exactly as it was found.
 */
function AddItem({ label, onAdd }: { label: string; onAdd: (description: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 self-start rounded-control px-1 py-0.5 text-meta text-ink-subtle pressable hover:bg-sunken hover:text-ink"
        onClick={() => setDraft("")}
      >
        <Plus {...smallIcon} aria-hidden="true" />
        {label}
      </button>
    );
  }

  const commit = (saving: boolean) => {
    const typed = draft.trim();
    setDraft(null);
    if (saving && typed !== "") onAdd(typed);
  };

  return (
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the traveler asked for it
      autoFocus
      aria-label={label}
      value={draft}
      placeholder="What happens?"
      onChange={(typed) => setDraft(typed.target.value)}
      onBlur={() => commit(true)}
      onKeyDown={(pressed) => {
        if (pressed.key === "Enter") commit(true);
        else if (pressed.key === "Escape") {
          pressed.preventDefault();
          pressed.stopPropagation();
          commit(false);
        } else return;
      }}
      className="w-full rounded-control border border-line-strong bg-surface px-2 py-1 text-input text-ink outline-none placeholder:text-ink-subtle focus:outline-2 focus:outline-offset-1 focus:outline-focus"
    />
  );
}

/**
 * What the plan still needs decided.
 *
 * Clicking one composes a message pursuing it and leaves it in the composer
 * unsent, the same way a first-run starter does: the question is the
 * advisor's phrasing, and what the traveler actually asks is theirs.
 */
function Questions({
  plan,
  lit,
  onAsk,
  onSettle,
}: {
  plan: TripPlan;
  lit: ReadonlySet<string>;
  onAsk: (question: string) => void;
  onSettle: (questionId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-mono text-micro uppercase text-ink-subtle">Open questions</h3>

      {plan.questions.length === 0 ? (
        <p className="text-meta text-ink-subtle">
          Nothing is waiting on a decision. What the plan still needs appears here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {plan.questions.map((asked) => (
            <li key={asked.id} className="flex items-stretch gap-1">
              <button
                type="button"
                className={`flex min-w-0 flex-1 items-start gap-2 rounded-control border border-line px-2 py-1.5 text-left text-meta text-open transition-colors duration-500 hover:border-line-strong active:translate-y-px ${
                  lit.has(asked.id) ? "bg-changed-tint" : "bg-open-tint"
                }`}
                onClick={() => onAsk(asked.question)}
              >
                <HelpCircle {...smallIcon} className="mt-0.5 shrink-0" aria-hidden="true" />
                {asked.question}
              </button>
              <button
                type="button"
                aria-label={`Settle: ${asked.question}`}
                className="shrink-0 rounded-control px-1 text-ink-subtle pressable hover:bg-sunken hover:text-ink"
                onClick={() => onSettle(asked.id)}
              >
                <X {...smallIcon} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The widths the facts under the masthead stand in at while they are read. */
const LOADING_ROWS = ["w-28", "w-20", "w-24"] as const;
