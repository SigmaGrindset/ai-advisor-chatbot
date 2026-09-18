/**
 * Whether the transcript should follow the reply being written.
 *
 * The rule the ticket states is about the traveler's intent, which is only
 * observable through one thing: where they left the transcript scrolled. If
 * they were at the foot, a reply arriving is something they are reading and
 * the view keeps up; if they had scrolled up, the arriving reply must not pull
 * the page out from under them.
 */

/** As much of a transcript's scroll position as the rule needs. */
export type Extent = { scrollTop: number; scrollHeight: number; clientHeight: number };

/**
 * How far above the foot still counts as being at it, in pixels.
 *
 * Sub-pixel layout means `scrollTop + clientHeight` frequently lands a fraction
 * short of `scrollHeight` at a genuine bottom, so an exact comparison would
 * stop following for no reason a traveler could see. A line and a half of body
 * text is also about the distance a single wheel notch moves, which is not a
 * decision to stop reading.
 */
export const FOOT = 40;

export function atBottom({ scrollTop, scrollHeight, clientHeight }: Extent): boolean {
  return scrollHeight - scrollTop - clientHeight <= FOOT;
}

/** Put the transcript at its foot, which is where a live reply is. */
export function toFoot(view: HTMLElement | null): void {
  if (view !== null) view.scrollTop = view.scrollHeight;
}
