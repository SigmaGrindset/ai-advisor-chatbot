/**
 * How much of an arriving reply is ready to be read out.
 *
 * A screen reader cannot watch a reply appear, so it has to be told — and the
 * traveler wants to follow the answer *as it arrives* rather than wait in
 * silence and then be read a wall of text. The unit that makes that bearable
 * is the sentence: announcing every fragment would be an unreadable stutter,
 * and announcing only at the end is not following anything.
 *
 * So the live region is given whole sentences, and never the half-written one
 * at the end — "The rate is 1." is worse than saying nothing yet.
 */

/**
 * The index up to which this text is settled enough to announce.
 *
 * `finished` releases the tail as well, because a reply that has stopped
 * arriving is not going to complete its last sentence, and what the traveler
 * was told is still what they were told.
 */
export function settled(text: string, finished = false): number {
  if (finished) return text.length;

  let upto = 0;
  for (let at = 0; at < text.length; at += 1) {
    const here = text[at]!;

    // A line that has ended is settled whatever it ends with: a heading or a
    // list item is a whole thought without a full stop on it.
    if (here === "\n") {
      upto = at;
      continue;
    }

    if (here !== "." && here !== "!" && here !== "?") continue;
    // A full stop between two digits is a figure, not the end of anything.
    if (here === "." && isDigit(text[at - 1]) && isDigit(text[at + 1])) continue;

    // Whatever follows the stop — more stops, a closing quote — belongs to the
    // sentence it ends, and the sentence is only over once a space proves that
    // more text has arrived after it.
    let end = at + 1;
    while (end < text.length && CLINGS.test(text[end]!)) end += 1;
    if (end < text.length && /\s/.test(text[end]!)) {
      upto = end;
      at = end;
    }
  }

  return upto;
}

/** What stays attached to the stop that ends a sentence. */
const CLINGS = /["'”’)\].!?]/;

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "0" && character <= "9";
}
