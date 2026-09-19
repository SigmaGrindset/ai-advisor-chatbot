/**
 * What a turn cost, in a figure somebody can read.
 *
 * The provider's own number for a turn is a fraction of a cent or a fraction
 * of a dollar — `0.0000362`, `0.015548` — so the two decimal places money is
 * normally written in would show most turns ever taken as `$0.00` or as each
 * other, which is worse than showing nothing: it reads as a claim they were
 * free, or that two turns cost the same when one cost twice the other. The
 * figure is written to the place it stops being interesting and no further,
 * and never to fewer places than money is written in.
 *
 * Kept apart from what draws it because the rule is a decision and the drawing
 * is not.
 */

/** As far as these figures are worth following. */
const PLACES = 6;

/** The smallest figure that many places can say. Below it, zeroes would lie. */
const SMALLEST = 10 ** -PLACES;

export function spent(usd: number): string {
  // Nothing recorded and nothing charged are different facts, and only the
  // second reaches here: a Message with no cost shows no figure at all.
  if (usd > 0 && usd < SMALLEST) return `under $${SMALLEST.toFixed(PLACES)}`;
  const written = usd.toFixed(PLACES).replace(/0+$/, "");
  // Two places at least, so that a turn which cost a round amount is still
  // written the way a price is: `$1.50`, and `$0.00` for a free model.
  return `$${written.padEnd(written.indexOf(".") + 3, "0")}`;
}
