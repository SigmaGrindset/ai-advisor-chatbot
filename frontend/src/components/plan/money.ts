/**
 * A budget, shown.
 *
 * Stated once because a budget is shown in two places — beside the
 * Conversation producing it and on the page listing every Trip — and the same
 * figure read two ways is two figures as far as the traveler is concerned.
 *
 * Grouped, never rounded away: the thousands are what makes a budget legible
 * at a glance, and a plan that quietly turned 2,400 into 2.4k would be
 * showing the traveler a number they did not type.
 */

const GROUPED = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

export function showAmount(amount: number): string {
  return GROUPED.format(amount);
}
