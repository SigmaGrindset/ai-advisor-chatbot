/**
 * What a Trip is called, wherever it is mentioned.
 *
 * Nobody is asked to title a Trip, so it is called after the first thing that
 * tells one journey from another: the destination, failing that the dates,
 * and failing both a line saying so rather than a number nobody chose.
 *
 * One reading, so a Trip is recognisable as the same Trip on the chip, in the
 * switcher and on the Trips page.
 */

import type { TripPlan } from "../../api/types";
import { showRange } from "../plan/dates";

export function tripName(plan: TripPlan): string {
  return (
    plan.destination ?? showRange(plan.starts_on, plan.ends_on) ?? "Destination not decided"
  );
}
