/**
 * The days of a Trip, said the way a traveler would say them.
 *
 * A plan keeps dates as calendar days and Itinerary Items as day *numbers*,
 * so moving a trip a week later is one change rather than a rewrite. What day
 * 2 falls on is the arithmetic done here.
 *
 * Everything works and formats in UTC: a calendar day is not an instant, and
 * `2026-05-12` read behind Greenwich becomes the evening of the 11th.
 */

const DAY = 24 * 60 * 60 * 1000;

/** How a date is shown: "12 May 2026". */
const FULL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** How the other end of a range is shown when the year is already said. */
const SAME_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** How a day of the itinerary is shown beside its number: "Wed 13 May". */
const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** A `YYYY-MM-DD` as a moment in UTC, or null when it is not one. */
function read(day: string | null): number | null {
  if (day === null) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (parts === null) return null;
  const at = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(at) ? null : at;
}

/** One date, shown: "12 May 2026", and null when there is not one. */
export function showDate(day: string | null): string | null {
  const at = read(day);
  return at === null ? null : FULL.format(at);
}

/**
 * A Trip's dates in a line: "12–18 May 2026", "From 12 May 2026", or null when
 * neither end has been decided. The year is said once where both share it.
 */
export function showRange(startsOn: string | null, endsOn: string | null): string | null {
  const from = read(startsOn);
  const to = read(endsOn);
  if (from !== null && to !== null) {
    const opening = sameYear(from, to) ? SAME_YEAR.format(from) : FULL.format(from);
    return `${opening} – ${FULL.format(to)}`;
  }
  if (from !== null) return `From ${FULL.format(from)}`;
  if (to !== null) return `Back on ${FULL.format(to)}`;
  return null;
}

/**
 * How many days a Trip runs for, counting both ends, and null while that is
 * not yet knowable.
 */
export function nights(startsOn: string | null, endsOn: string | null): number | null {
  const from = read(startsOn);
  const to = read(endsOn);
  if (from === null || to === null || to < from) return null;
  return Math.round((to - from) / DAY) + 1;
}

/**
 * What day N of the trip falls on: "Wed 13 May", and null while the trip has
 * no start date to count from.
 */
export function showDay(day: number, startsOn: string | null): string | null {
  const from = read(startsOn);
  if (from === null || day < 1) return null;
  return WEEKDAY.format(from + (day - 1) * DAY);
}

function sameYear(from: number, to: number): boolean {
  return new Date(from).getUTCFullYear() === new Date(to).getUTCFullYear();
}
