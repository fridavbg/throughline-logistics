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

/** The time zone dates are shown in: Spain, where the demo clock is set. */
export const DEMO_TIME_ZONE = "Europe/Madrid";

// Intl with a fixed time zone instead of date-fns `format`, which uses the time zone of the
// machine running the code: the server, the browser and CI could show different days.
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: DEMO_TIME_ZONE,
});

/**
 * A date the way the UI shows it, e.g. `formatDay("2026-10-23T12:00:00Z")` → "Fri 23 Oct".
 * An unreadable date gives "date unknown" instead of throwing, so one bad operator value
 * can't break a whole page, and no date is made up.
 */
export function formatDay(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "date unknown" : dayFormat.format(ms);
}

/** A window of days: "Fri 23 Oct", or "Fri 23 Oct – Sat 24 Oct" when it spans days. */
export function formatDayRange(earliest: string, latest: string): string {
  const [from, to] = [formatDay(earliest), formatDay(latest)];
  return from === to ? from : `${from} – ${to}`;
}

/**
 * How long ago something happened, for freshness: "12 min ago", "3h ago", "2 days ago".
 * A time in the future (clock skew) counts as "just now".
 */
export function formatAgo(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / MINUTE_MS);
  if (Number.isNaN(minutes)) return "time unknown";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// Helpers for seed data: times relative to the demo clock, such as "updated 31 hours ago".
// They add plain milliseconds instead of using date-fns `addDays`, because `addDays` keeps
// the local clock time, so its result would depend on the timezone of the machine running
// the code. Summer time ends on 25 October, inside the demo window, which would shift seed
// times by an hour on some machines and not others.
const MINUTE_MS = 60 * 1000;
/** One hour in milliseconds, for comparing times. */
export const HOUR_MS = 60 * MINUTE_MS;
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
