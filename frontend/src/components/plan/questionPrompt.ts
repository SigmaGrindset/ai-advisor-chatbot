/**
 * What clicking an Open Question puts in the composer.
 *
 * It is composed and *not* sent, like the opening prompts on a first visit:
 * the question is the advisor's phrasing of something undecided, and the
 * traveler is the one who decides what they actually want to ask about it.
 * They can edit every word of it before it goes.
 */

/** The message a traveler would send to pursue this Open Question. */
export function questionPrompt(question: string): string {
  const asked = question.trim();
  if (asked === "") return "";
  // A question the advisor wrote without its question mark is still a
  // question; the traveler's message should read as one.
  const punctuated = /[?.!]$/.test(asked) ? asked : `${asked}?`;
  return `Let's settle this: ${punctuated}`;
}
