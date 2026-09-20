/**
 * What happens to the Trip Plan on screen when the advisor patches it.
 *
 * Ordinarily it becomes the plan that arrived; the exception is the field the
 * traveler has open. That keeps their value, and what the advisor wanted is
 * kept aside as a suggestion rather than written over.
 *
 * Their typing is safe either way — a draft lives in the field. What this
 * protects is the value underneath: Escape must come back to what they had,
 * and blur must save what they typed rather than lose a race with a patch.
 *
 * Separated from the panel because which of two writers wins a field is a
 * decision, and drawing a plan is not.
 */

import type { TripPlan } from "../../api/types";
import { valueOf } from "./fields";

/**
 * What the traveler is editing: a scalar by its name, an Itinerary Item by
 * its identifier — the same names the server sends back as having changed, so
 * the two sides need no mapping between them.
 */
export type Editing = string | null;

/** A change the advisor wanted for a field the traveler had open. */
export type Suggestion = { field: string; value: string };

export type Merged = {
  plan: TripPlan;
  /** Empty unless the patch and the traveler reached for the same field. */
  suggestions: Suggestion[];
};

/**
 * The plan to show once a patch has arrived, and anything it wanted for a
 * field that was not its to take. A field the traveler has open that the
 * patch did not move is not a conflict.
 */
export function merged(
  showing: TripPlan | null,
  incoming: TripPlan,
  changed: readonly string[],
  editing: Editing,
): Merged {
  // Nothing open, nothing to show yet, or a different Trip — in which case
  // whatever was open was open on another plan.
  if (editing === null || showing === null || showing.trip_id !== incoming.trip_id) {
    return { plan: incoming, suggestions: [] };
  }

  const mine = valueOf(showing, editing);
  const theirs = valueOf(incoming, editing);
  // An Item the advisor removed while it was being edited: the row is gone,
  // so there is no field left to be immune.
  if (mine === null || theirs === null) return { plan: incoming, suggestions: [] };

  return {
    plan: keeping(incoming, showing, editing),
    suggestions:
      changed.includes(editing) && theirs !== mine ? [{ field: editing, value: theirs }] : [],
  };
}

/** The incoming plan with one field left as the traveler had it. */
function keeping(incoming: TripPlan, showing: TripPlan, field: string): TripPlan {
  switch (field) {
    case "destination":
      return { ...incoming, destination: showing.destination };
    case "starts_on":
      return { ...incoming, starts_on: showing.starts_on };
    case "ends_on":
      return { ...incoming, ends_on: showing.ends_on };
    case "party_size":
      return { ...incoming, party_size: showing.party_size };
    case "budget_amount":
      return { ...incoming, budget_amount: showing.budget_amount };
    case "budget_currency":
      return { ...incoming, budget_currency: showing.budget_currency };
    default:
      return { ...incoming, items: incoming.items.map((item) => kept(item, showing, field)) };
  }
}

function kept(
  item: TripPlan["items"][number],
  showing: TripPlan,
  field: string,
): TripPlan["items"][number] {
  if (item.id !== field) return item;
  const mine = showing.items.find((held) => held.id === field);
  return mine === undefined ? item : { ...item, description: mine.description };
}
