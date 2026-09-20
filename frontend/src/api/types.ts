/**
 * The resources the API talks about, kept apart from the calls that fetch
 * them: most of what reads a Conversation is handed one rather than fetching it.
 */

export type MessageRole = "traveler" | "advisor";

/** Where something in an advisor Message was fetched from. */
export type Citation = {
  /** The service's own name, as the traveler would recognise it. */
  service: string;
  about: string;
  /** Null when there is nowhere to go, as for a search that cited no page. */
  url: string | null;
  /** The query a web search sent, and null on every other Citation. */
  query: string | null;
};

/**
 * Whose problem a failed turn is: the first two are the traveler's to fix,
 * `upstream` is nobody's and worth trying again, and `application` is ours.
 */
export type FailureKind = "configuration" | "credit" | "upstream" | "application";

/** Why a turn did not answer, as the traveler is told about it. */
export type Failure = {
  kind: FailureKind;
  /** What happened and what would change it. */
  detail: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  /**
   * The Prompt Version that produced this Message, so an advisor which starts
   * answering differently partway through can be explained. Null on a traveler
   * Message, which no prompt produced.
   */
  prompt_version_id: string | null;
  cost_usd: number | null;
  citations: Citation[];
  /**
   * Why the turn stopped. A Message carrying one holds whatever had arrived of
   * the reply, which may be nothing: the marker is what tells a turn that died
   * from an advisor with nothing to say, and it survives a reload.
   */
  failure: Failure | null;
};

/** A Conversation as it appears in the list, without its transcript. */
export type ConversationSummary = {
  id: string;
  /** Null until the first exchange has been named. */
  title: string | null;
  last_activity_at: string;
  /** Carried on the row so the list can mark each one without reading it. */
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

/**
 * The Advisor Instructions, and the prompt they are composed into. Both
 * together, because the second is only true of the first.
 */
export type AdvisorInstructions = {
  /** The editable part: the advisor's persona and its rules. */
  instructions: string;
  /** Recorded on every Message, which makes a change in behaviour explicable. */
  version_id: string;
  /** The system prompt exactly as the next message will send it. */
  composed: string;
  /** Whether what is in force is the shipped default. */
  is_default: boolean;
};

/**
 * What a Profile Fact is about. The traveler has exactly one of the first
 * three, which is how a correction lands as a correction; `note` collects
 * everything a fixed set could not anticipate.
 */
export type ProfileSubject = "nationality" | "home_city" | "companions" | "note";

/**
 * One thing the advisor durably knows about the traveler. Addressable on its
 * own, so deleting one leaves every other exactly as it was.
 */
export type ProfileFact = {
  id: string;
  subject: ProfileSubject;
  /** In the words the traveler would recognise. */
  detail: string;
};

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
 * Every field is nullable: a plan is born the moment the first thing about the
 * trip is worth recording. Dates are calendar days, `YYYY-MM-DD`, not instants.
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
