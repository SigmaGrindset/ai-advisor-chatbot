/**
 * What the application's API talks about.
 *
 * The resources themselves, kept apart from the calls that fetch them because
 * most of what reads a Conversation never fetches one: a component is handed
 * what it draws. Separating them is about what a file is for, not about what
 * ships — these are types, so nothing of them survives compilation either way.
 */

export type MessageRole = "traveler" | "advisor";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  cost_usd: number | null;
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
