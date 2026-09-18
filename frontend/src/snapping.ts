/**
 * Where a sheet a traveler has dragged comes to rest.
 *
 * A sheet is described by the places it is allowed to stop at — its snap
 * points — each a fraction of its own size, from `0` for closed to `1` for
 * fully out. A left sheet has one such place and is otherwise closed; a bottom
 * sheet has several, which is what lets the Trip Plan be glanced at or read.
 *
 * The rule is separated from the dragging because it is the part with an
 * opinion in it: a thumb never lets go exactly on a snap point, and what
 * happens to the sheet when it does not is a decision, not a measurement.
 */

/**
 * How fast a drag has to be moving to count as a flick, in extents a second.
 *
 * Below it a release is read as "put it here", and the sheet goes to the
 * nearest place it is allowed to be. Above it the release is read as a
 * throw, and where the thumb happened to be at the time stops mattering. A
 * sheet filling the height of a phone travels its whole extent in about a
 * second and a half at this speed, which is a deliberate movement rather than
 * the tail of a scroll.
 */
export const FLICK = 0.6;

/**
 * The place a sheet settles, given where it was let go and how fast.
 *
 * `extent` and the `stops` are fractions of the sheet's size. `velocity` is in
 * extents a second and is positive when the sheet is being opened, whichever
 * edge it came from. The answer is always `0` or one of the stops.
 */
export function resting(extent: number, velocity: number, stops: readonly number[]): number {
  const places = [0, ...stops].sort((a, b) => a - b);

  if (Math.abs(velocity) >= FLICK) {
    // Thrown. The next place in the direction of the throw, and only the
    // next: a hard flick is a request for the following state, not a request
    // to skip whatever is between here and the end.
    const beyond =
      velocity > 0
        ? places.find((place) => place > extent)
        : [...places].reverse().find((place) => place < extent);
    // Nothing beyond means it was thrown at a wall, so it stays where it is —
    // which is the nearest place, since a wall is one.
    if (beyond !== undefined) return beyond;
  }

  // Put down. The nearest place it is allowed to be, and on a tie the larger
  // of the two: a sheet that closes on an exactly-half drag is a sheet that
  // takes away what the traveler was reaching for.
  return places.reduce((nearest, place) =>
    Math.abs(place - extent) <= Math.abs(nearest - extent) ? place : nearest,
  );
}
