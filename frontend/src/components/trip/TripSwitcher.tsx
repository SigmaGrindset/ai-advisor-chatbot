import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { TripPlan } from "../../api/types";
import { showRange } from "../plan/dates";
import { tripName } from "./naming";
import { smallIcon } from "../../design/icons";
import { TripChip } from "./TripChip";

/**
 * Which Trip this Conversation is refining, and the way to say otherwise.
 *
 * The advisor decides what a Conversation is about and can decide wrong — it is
 * shown the Trips and picks one, or starts another (ADR-0002) — so the one
 * correction the traveler needs is right where the mistake shows: at the head
 * of the plan that turned out to belong to a different journey.
 *
 * It opens in place rather than over anything, as the Conversation list's row
 * actions do. On a phone this control is inside the record sheet, and a menu
 * floating out of a modal dialog is a second layer to escape from; a list
 * that pushes the plan down is one.
 */
export function TripSwitcher({
  plan,
  trips,
  onChoose,
}: {
  /** The Trip this Conversation is refining, and null while it is refining none. */
  plan: TripPlan | null;
  /** Every Trip the traveler has, the most recently started first. */
  trips: TripPlan[];
  /** Attach this Conversation to that Trip, or to none. */
  onChoose: (tripId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  // Nothing to move between. A traveler planning their first journey has one
  // Trip at most, and a control offering to take them off it before the
  // advisor has written anything down is an invitation to undo the only thing
  // that has happened.
  if (trips.length === 0) return null;

  const choose = (tripId: string | null) => {
    setOpen(false);
    if (tripId !== (plan?.trip_id ?? null)) onChoose(tripId);
  };

  return (
    <div
      className="flex flex-col gap-1"
      onKeyDown={(pressed) => {
        if (pressed.key !== "Escape" || !open) return;
        // Both, and for two different reasons: the sheet this can be inside
        // closes on Escape from a handler further up, and the dialog itself
        // closes on the key's own default action. One press is one thing.
        pressed.preventDefault();
        pressed.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          plan === null
            ? "This conversation is not on a trip. Put it on one."
            : `Trip: ${tripName(plan)}. Move this conversation to another trip.`
        }
        className="flex w-full items-center gap-2 rounded-control border border-line bg-canvas px-2 py-1.5 text-left transition-colors hover:border-line-strong"
        onClick={() => setOpen(!open)}
      >
        {plan === null ? (
          <span className="min-w-0 flex-1 truncate text-meta text-ink-subtle">
            Not on a trip
          </span>
        ) : (
          <span className="flex min-w-0 flex-1">
            <TripChip plan={plan} />
          </span>
        )}
        <ChevronDown
          {...smallIcon}
          className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-1 rounded-control border border-line bg-canvas p-1">
          {/* Said where the choosing happens, because this control writes. A
              chip and a chevron read as a way of looking at another Trip, and
              what it actually does is move this Conversation onto one — which
              a traveler should be told before they press, not by watching the
              plan beside them change. */}
          <p className="px-2 pt-1 font-mono text-micro uppercase text-ink-subtle">
            Move this conversation to
          </p>
          <ul className="flex flex-col gap-0.5">
            {trips.map((trip) => (
              <li key={trip.trip_id} className="flex">
                <Choice
                  chosen={trip.trip_id === plan?.trip_id}
                  onChoose={() => choose(trip.trip_id)}
                >
                  <TripChip plan={trip} />
                  {showRange(trip.starts_on, trip.ends_on) !== null && (
                    <span className="truncate font-mono text-micro text-ink-subtle">
                      {showRange(trip.starts_on, trip.ends_on)}
                    </span>
                  )}
                </Choice>
              </li>
            ))}

            {/* Taking a Conversation off a Trip is the other half of putting
                it on one: an aside about somewhere else does not belong to
                the journey the advisor attached it to. */}
            <li className="flex">
              <Choice chosen={plan === null} onChoose={() => choose(null)}>
                <span className="truncate text-meta text-ink-muted">Not on a trip</span>
              </Choice>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

/** One Trip in the list, and whether it is the one being refined. */
function Choice({
  chosen,
  onChoose,
  children,
}: {
  chosen: boolean;
  onChoose: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={chosen ? "true" : undefined}
      className="flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-sunken"
      onClick={onChoose}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {chosen && <Check {...smallIcon} className="shrink-0 text-accent" aria-hidden="true" />}
    </button>
  );
}
