/**
 * The Traveler Profile as a list a person reads.
 *
 * The server answers in the order things were learned, which is what a log
 * wants rather than a record: here the three subjects the traveler has one of
 * stand in the same places whatever was learned first, and the rest follow.
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

/** One fact in a line, for the control that deletes it. */
export function factSaid(fact: ProfileFact): string {
  return `${SUBJECT_LABELS[fact.subject]}: ${fact.detail}`;
}
