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

/**
 * The same, but travelled rather than jumped.
 *
 * For the control that offers a traveler who has scrolled up the way back
 * down, and for that alone. A reply arriving is followed instantly, because
 * a smooth scroll chasing text that is still being written never catches it
 * — it is still easing towards where the foot was two fragments ago. A
 * traveler who pressed "Jump to latest" is not being chased by anything, and
 * a page that travels the distance shows them how far they had come.
 *
 * The preference is read here rather than left to the stylesheet. `base.css`
 * forces `scroll-behavior: auto` under reduced motion, and that is exactly
 * the property a `behavior` passed to `scrollTo` overrules — asking for
 * `smooth` in so many words is asking for it whatever the page says. So the
 * ask itself is what has to be withdrawn.
 */
export function toFootSmoothly(view: HTMLElement | null): void {
  if (view === null) return;
  const asked = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  view.scrollTo({ top: view.scrollHeight, behavior: asked ? "auto" : "smooth" });
}
