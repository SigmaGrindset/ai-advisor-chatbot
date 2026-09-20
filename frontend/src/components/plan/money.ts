/**
 * A budget, shown. Stated once because it appears in two places, and the same
 * figure read two ways is two figures. Grouped but never rounded away: 2.4k
 * is a number the traveler did not type.
 */

const GROUPED = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

export function showAmount(amount: number): string {
  return GROUPED.format(amount);
}
