/**
 * What clicking an Open Question puts in the composer. Composed and *not*
 * sent, like the opening prompts: the phrasing is the advisor's, and what the
 * traveler actually asks is theirs to edit first.
 */

/** The message a traveler would send to pursue this Open Question. */
export function questionPrompt(question: string): string {
  const asked = question.trim();
  if (asked === "") return "";
  // The advisor's question may arrive without its question mark; the
  // traveler's message should still read as one.
  const punctuated = /[?.!]$/.test(asked) ? asked : `${asked}?`;
  return `Let's settle this: ${punctuated}`;
}
