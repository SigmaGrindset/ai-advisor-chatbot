/**
 * What a Conversation is called in the interface.
 *
 * A Conversation has no title until its first exchange has been named, and an
 * unnamed one still has to be sayable — in the list, in the header, and in the
 * label on the control that deletes it.
 */
export function conversationName(title: string | null): string {
  return title ?? "New conversation";
}

/**
 * The longest a Conversation's name can be, which is what the API will store
 * (`advisor/titles.py`) and so what the field the traveler types it into
 * stops at. A title is what a Conversation is recognised by in a rail one row
 * high: one that does not fit is one nobody reads the end of.
 */
export const MAX_NAME = 48;
