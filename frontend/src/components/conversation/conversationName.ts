/**
 * What a Conversation is called in the interface. It has no title until its
 * first exchange has been named, and an unnamed one still has to be sayable.
 */
export function conversationName(title: string | null): string {
  return title ?? "New conversation";
}

/**
 * The longest a Conversation's name can be — what the API stores
 * (`advisor/titles.py`), and so where the field stops. A title too long for a
 * rail one row high is one nobody reads the end of.
 */
export const MAX_NAME = 48;
