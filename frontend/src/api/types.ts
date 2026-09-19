/**
 * What the application's API talks about.
 *
 * The resources themselves, kept apart from the calls that fetch them because
 * most of what reads a Conversation never fetches one: a component is handed
 * what it draws. Separating them is about what a file is for, not about what
 * ships — these are types, so nothing of them survives compilation either way.
 */

export type MessageRole = "traveler" | "advisor";

/** Where something in an advisor Message was fetched from. */
export type Citation = {
  /** The service's own name, or the site's, as the traveler would recognise it. */
  service: string;
  /** What was looked up there, in words. */
  about: string;
  /**
   * The exact request that produced it, so they can go and look. Null when
   * there is nowhere to go: a web search that came back citing no page still
   * has the query it sent to answer for.
   */
  url: string | null;
  /**
   * The exact query a web search sent, and null on every other Citation. It is
   * what a traveler opens a search Citation to see — the search query is the
   * one thing this application sends out in the traveler's own words, and it
   * is checked before it goes.
   */
  query: string | null;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  cost_usd: number | null;
  /** Empty unless the turn that produced this Message looked something up. */
  citations: Citation[];
};

/** A Conversation as it appears in the list, without its transcript. */
export type ConversationSummary = {
  id: string;
  /** Null until the first exchange has been named. */
  title: string | null;
  last_activity_at: string;
  /**
   * The Trip this Conversation is refining, and null while it is refining
   * none. The row carries it so the list can say which journey each one
   * belongs to without reading each Conversation to find out.
   */
  trip_id: string | null;
};

export type Conversation = {
  id: string;
  title: string | null;
  messages: Message[];
};

/**
 * What reading a Conversation back gives: the Conversation, and the Trip Plan
 * it is refining. The plan comes with the transcript rather than from a second
 * request, because the two are opened together and shown together (ADR-0006).
 */
export type ConversationRead = Conversation & { plan: TripPlan | null };

/** Roughly when in a day an Itinerary Item happens, which is as exact as a plan gets. */
export type PartOfDay = "morning" | "afternoon" | "evening";

/** One thing planned for a particular day of a Trip. */
export type ItineraryItem = {
  id: string;
  /** Day 1 is the first day of the Trip, whenever that turns out to be. */
  day: number;
  /** Null for something planned for a day with no time in mind. */
  part_of_day: PartOfDay | null;
  description: string;
};

/** Something the Trip Plan still needs decided. */
export type OpenQuestion = { id: string; question: string };

/**
 * The structured, durable record of a Trip. A Trip has exactly one, and
 * several Conversations may refine it.
 *
 * Every field is nullable because a plan is born the moment the first thing
 * about the trip is worth recording and knows nothing else yet. The dates are
 * kept as the calendar days they are, `YYYY-MM-DD`, never as instants.
 */
export type TripPlan = {
  trip_id: string;
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
  party_size: number | null;
  budget_amount: number | null;
  /** ISO 4217, upper case. */
  budget_currency: string | null;
  items: ItineraryItem[];
  questions: OpenQuestion[];
};

/** The fields of a Trip Plan that hold one value each, as both sides name them. */
export const PLAN_FIELDS = [
  "destination",
  "starts_on",
  "ends_on",
  "party_size",
  "budget_amount",
  "budget_currency",
] as const;

export type PlanField = (typeof PLAN_FIELDS)[number];

/**
 * A change to those fields: only what it names is written, and a field named
 * as null is one the traveler emptied rather than one they did not touch.
 */
export type PlanPatch = Partial<Pick<TripPlan, PlanField>>;
