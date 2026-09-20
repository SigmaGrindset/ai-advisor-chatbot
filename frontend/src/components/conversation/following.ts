/**
 * Whether the transcript should follow the reply being written.
 *
 * Intent is observable through one thing: where they left the transcript
 * scrolled. At the foot, the view keeps up; scrolled up, the arriving reply
 * must not pull the page out from under them.
 */

/** As much of a transcript's scroll position as the rule needs. */
export type Extent = { scrollTop: number; scrollHeight: number; clientHeight: number };

/**
 * How far above the foot still counts as being at it, in pixels.
 *
 * Sub-pixel layout lands a fraction short of `scrollHeight` at a genuine
 * bottom, so an exact comparison would stop following for no visible reason.
 * It is also about one wheel notch, which is not a decision to stop reading.
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
 * The same, but travelled rather than jumped — for the "Jump to latest"
 * control alone. A reply arriving is followed instantly, because a smooth
 * scroll chasing text still being written never catches it.
 *
 * The motion preference is read here rather than left to the stylesheet: a
 * `behavior` passed to `scrollTo` overrules the `scroll-behavior` that
 * `base.css` forces, so the ask itself has to be withdrawn.
 */
export function toFootSmoothly(view: HTMLElement | null): void {
  if (view === null) return;
  const asked = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  view.scrollTo({ top: view.scrollHeight, behavior: asked ? "auto" : "smooth" });
}
