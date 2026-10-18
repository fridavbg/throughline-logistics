// Fixed demo clock: the deployed demo looks identical on every visit.
// All time-based logic calls getNow(), never new Date().

export const DEMO_NOW = new Date("2026-10-21T10:00:00+02:00");

// Returns a fresh Date each call: Date is mutable, so handing out DEMO_NOW itself would let
// one caller's setHours() shift the clock for everyone.
export function getNow(): Date {
  return new Date(DEMO_NOW.getTime());
}
