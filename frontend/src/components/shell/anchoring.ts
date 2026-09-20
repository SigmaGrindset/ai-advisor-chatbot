/**
 * Where a small panel goes when it is anchored to the control that opened it.
 *
 * A menu hanging off a button has one job beyond looking like a menu: it must
 * stay on the screen. A row near the floor of the Conversation list would hang
 * its menu off the bottom of the window, and a row at the left edge of a phone
 * would hang it off the side — so the rule is to prefer the obvious placement
 * and give it up only when the obvious placement would put the panel somewhere
 * the traveler cannot reach.
 *
 * Separated from the drawing because it is the part with an opinion in it, and
 * because the opinion is arithmetic: the browser will happily position a panel
 * off the edge of the world, and nothing on the page says otherwise.
 *
 * Everything here is in CSS pixels, in the coordinates `getBoundingClientRect`
 * speaks — the visible window, with its top-left corner at the origin.
 */

/** The control a panel is hanging off. */
export type Anchor = { top: number; left: number; width: number; height: number };

export type Size = { width: number; height: number };

/** Where the panel's top-left corner goes. */
export type Place = { top: number; left: number };

/**
 * The air between a panel and the control it belongs to.
 *
 * Enough that the panel reads as its own sheet of paper rather than as more
 * of the button, and not so much that the two stop looking joined.
 */
export const GAP = 6;

/** How near a panel is allowed to come to the edge of the window. */
export const MARGIN = 8;

/**
 * Where to put a panel of this size, anchored to this control.
 *
 * Below the control and with their right edges in line, which is where a menu
 * opened from a control at the right-hand end of a row is looked for. It goes
 * above instead when there is no room below and there is room above, and it is
 * held inside the window either way.
 */
export function anchored(anchor: Anchor, panel: Size, view: Size): Place {
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - panel.height - GAP;
  // The lowest top that still leaves the whole panel on screen.
  const floor = view.height - panel.height - MARGIN;

  return {
    // Below unless below does not fit and above does. A panel too tall for
    // either stays below and is clamped, because the top of a panel is the
    // end a traveler reads from: pinning its foot to the floor of the window
    // would scroll the first thing it says off the top.
    top: held(below <= floor || above < MARGIN ? below : above, MARGIN, floor),
    left: held(
      anchor.left + anchor.width - panel.width,
      MARGIN,
      view.width - panel.width - MARGIN,
    ),
  };
}

/**
 * A number pushed inside a range.
 *
 * The range can be inside out — a panel wider or taller than the window it is
 * in has no room at all — and one that is comes to rest against `least`, which
 * is the corner the panel is read from.
 */
function held(value: number, least: number, most: number): number {
  return Math.max(least, Math.min(value, most));
}
