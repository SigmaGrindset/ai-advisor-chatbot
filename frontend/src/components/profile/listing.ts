/**
 * The Traveler Profile as a list a person reads: what order it is in, and how
 * one fact is said.
 *
 * The server answers in the order the advisor learned things, which is the
 * order a log wants and not the order a record does. A profile is a small
 * record: the three things the traveler has one of stand in the same places
 * whichever the advisor happened to learn first, and everything else follows
 * in the order it was learned.
 */

import type { ProfileFact, ProfileSubject } from "../../api/types";

/** What each subject is called, where a fact is read rather than stored. */
export const SUBJECT_LABELS: Record<ProfileSubject, string> = {
  nationality: "Nationality",
  home_city: "Home city",
  companions: "Travels with",
  note: "Note",
};

/** The order the fixed subjects stand in, whatever order they were learned in. */
const READING_ORDER: ProfileSubject[] = ["nationality", "home_city", "companions", "note"];

/**
 * The profile as it is read: the fixed subjects first and in their own order,
 * then the notes, each group keeping the order it arrived in.
 */
export function inReadingOrder(facts: ProfileFact[]): ProfileFact[] {
  return READING_ORDER.flatMap((subject) => facts.filter((fact) => fact.subject === subject));
}

/**
 * One fact in a line, for the places that can only have one — the control
 * that deletes it, which has to say which one it is deleting.
 */
export function factSaid(fact: ProfileFact): string {
  return `${SUBJECT_LABELS[fact.subject]}: ${fact.detail}`;
}
