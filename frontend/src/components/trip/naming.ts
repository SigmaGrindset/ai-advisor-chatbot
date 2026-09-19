/**
 * What a Trip is called, wherever it is mentioned.
 *
 * A Trip has no name of its own — nobody is asked to title one — so it is
 * called after the first thing about it that tells one journey from another.
 * The destination does that; failing a destination, the dates do; and a Trip
 * with neither is said to be missing the one a traveler would look for rather
 * than given a number nobody chose.
 *
 * One reading, because a Trip has to be recognisable as the same Trip on the
 * chip beside a Conversation, in the switcher and on the Trips page.
 */

import type { TripPlan } from "../../api/types";
import { showRange } from "../plan/dates";

export function tripName(plan: TripPlan): string {
  return (
    plan.destination ?? showRange(plan.starts_on, plan.ends_on) ?? "Destination not decided"
  );
}
