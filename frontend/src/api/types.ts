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
};

export type Conversation = {
  id: string;
  title: string | null;
  messages: Message[];
};
