/**
 * How much of an arriving reply is ready to be read out.
 *
 * The sentence is the unit that makes following a reply bearable: every
 * fragment is an unreadable stutter, and only the end is not following
 * anything. So the live region gets whole sentences and never the
 * half-written one — "The rate is 1." is worse than saying nothing yet.
 */

/**
 * The index up to which this text is settled enough to announce. `finished`
 * releases the tail too, a reply that has stopped arriving not being about to
 * complete its last sentence.
 */
export function settled(text: string, finished = false): number {
  if (finished) return text.length;

  let upto = 0;
  for (let at = 0; at < text.length; at += 1) {
    const here = text[at]!;

    // A line that has ended is settled whatever it ends with: a heading is a
    // whole thought without a full stop on it.
    if (here === "\n") {
      upto = at;
      continue;
    }

    if (here !== "." && here !== "!" && here !== "?") continue;
    // A full stop between two digits is a figure, not the end of anything.
    if (here === "." && isDigit(text[at - 1]) && isDigit(text[at + 1])) continue;

    // What follows the stop — more stops, a closing quote — belongs to the
    // sentence, which is over only once a space proves more text arrived.
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
