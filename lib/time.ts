/**
 * The demo's clock. The app runs at a fixed moment, so the deployed demo looks the same
 * on every visit. Code reads the time through `getNow()`, never `new Date()`; a lint rule
 * enforces this.
 */

/** The fixed moment the demo runs at: Wednesday 21 October 2026, 10:00 in Spain. */
export const DEMO_NOW = new Date("2026-10-21T10:00:00+02:00");

/**
 * The current time in the demo.
 *
 * Returns a new copy on every call. A `Date` can be changed in place, so handing out
 * `DEMO_NOW` itself would let one caller's `setHours()` move the clock for everyone.
 */
export function getNow(): Date {
  return new Date(DEMO_NOW.getTime());
}

// Helpers for seed data: times relative to the demo clock, such as "updated 31 hours ago".
// They add plain milliseconds instead of using date-fns `addDays`, because `addDays` keeps
// the local clock time, so its result would depend on the timezone of the machine running
// the code. Summer time ends on 25 October, inside the demo window, which would shift seed
// times by an hour on some machines and not others.
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function offsetFromNow(ms: number): string {
  return new Date(DEMO_NOW.getTime() + ms).toISOString();
}

/** The demo time `minutes` ago, as an ISO string. `minutesAgo(25)` → 09:35 in Spain. */
export function minutesAgo(minutes: number): string {
  return offsetFromNow(-minutes * MINUTE_MS);
}

/** The demo time `hours` ago, as an ISO string. `hoursAgo(31)` → the day before, 03:00 in Spain. */
export function hoursAgo(hours: number): string {
  return offsetFromNow(-hours * HOUR_MS);
}

/** The demo time `days` ago, as an ISO string. Each day is exactly 24 hours. */
export function daysAgo(days: number): string {
  return offsetFromNow(-days * DAY_MS);
}

/** The demo time `minutes` from now, as an ISO string. */
export function minutesFromNow(minutes: number): string {
  return offsetFromNow(minutes * MINUTE_MS);
}

/** The demo time `hours` from now, as an ISO string. */
export function hoursFromNow(hours: number): string {
  return offsetFromNow(hours * HOUR_MS);
}

/** The demo time `days` from now, as an ISO string. Each day is exactly 24 hours. */
export function daysFromNow(days: number): string {
  return offsetFromNow(days * DAY_MS);
}
