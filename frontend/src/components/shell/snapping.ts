/**
 * Where a sheet a traveler has dragged comes to rest.
 *
 * A sheet's snap points are fractions of its own size, `0` closed to `1` out.
 * Separated from the dragging because it is the part with an opinion in it: a
 * thumb never lets go exactly on a snap point.
 */

/**
 * How fast a drag has to be moving to count as a flick, in extents a second.
 * Below it a release means "put it here"; above it, a throw. At this speed a
 * full-height sheet crosses its extent in about a second and a half, which is
 * a deliberate movement rather than the tail of a scroll.
 */
export const FLICK = 0.6;

/**
 * The place a sheet settles, given where it was let go and how fast.
 *
 * `extent` and `stops` are fractions of the sheet's size; `velocity` is in
 * extents a second, positive when opening. The answer is `0` or one of the stops.
 */
export function resting(extent: number, velocity: number, stops: readonly number[]): number {
  const places = [0, ...stops].sort((a, b) => a - b);

  if (Math.abs(velocity) >= FLICK) {
    // The next place in the direction of the throw, and only the next: a hard
    // flick asks for the following state, not for the end.
    const beyond =
      velocity > 0
        ? places.find((place) => place > extent)
        : [...places].reverse().find((place) => place < extent);
    // Nothing beyond means it was thrown at a wall, so it stays put.
    if (beyond !== undefined) return beyond;
  }

  // Put down: the nearest place, and on a tie the larger — a sheet closing on
  // an exactly-half drag takes away what the traveler was reaching for.
  return places.reduce((nearest, place) =>
    Math.abs(place - extent) <= Math.abs(nearest - extent) ? place : nearest,
  );
}
