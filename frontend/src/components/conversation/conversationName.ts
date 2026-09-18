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
