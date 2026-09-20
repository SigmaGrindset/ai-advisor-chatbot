/**
 * Where a small panel goes when it is anchored to the control that opened it.
 *
 * A menu hanging off a button must stay on the screen: prefer the obvious
 * placement, and give it up only where that would put the panel somewhere the
 * traveler cannot reach. Separated from the drawing because it is arithmetic,
 * and the browser will happily position a panel off the edge of the world.
 *
 * Everything here is CSS pixels in `getBoundingClientRect` coordinates.
 */

/** The control a panel is hanging off. */
export type Anchor = { top: number; left: number; width: number; height: number };

export type Size = { width: number; height: number };

/** Where the panel's top-left corner goes. */
export type Place = { top: number; left: number };

/**
 * The air between a panel and its control: enough that the panel reads as its
 * own sheet of paper, not so much that the two stop looking joined.
 */
export const GAP = 6;

/** How near a panel is allowed to come to the edge of the window. */
export const MARGIN = 8;

/**
 * Where to put a panel of this size, anchored to this control: below it with
 * their right edges in line, or above when there is no room below, and held
 * inside the window either way.
 */
export function anchored(anchor: Anchor, panel: Size, view: Size): Place {
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - panel.height - GAP;
  // The lowest top that still leaves the whole panel on screen.
  const floor = view.height - panel.height - MARGIN;

  return {
    // Below unless below does not fit and above does. One too tall for either
    // stays below and is clamped: the top is the end a traveler reads from.
    top: held(below <= floor || above < MARGIN ? below : above, MARGIN, floor),
    left: held(
      anchor.left + anchor.width - panel.width,
      MARGIN,
      view.width - panel.width - MARGIN,
    ),
  };
}

/**
 * A number pushed inside a range. The range can be inside out — a panel bigger
 * than its window — and one that is rests against `least`, the corner it is
 * read from.
 */
function held(value: number, least: number, most: number): number {
  return Math.max(least, Math.min(value, most));
}
