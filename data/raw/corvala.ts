/**
 * Corvala Transport messages, as their API sends them (docs/DATA_MODEL.md §6):
 * samples for the adapter tests, and the feed behind the seed shipments.
 */
import type { CorvalaPayload } from "@/lib/normalize/corvala";
import { hoursAgo, minutesAgo } from "@/lib/time";

/** Messages that build the seed scenarios (docs/DATA_MODEL.md §7). */
export const corvalaFeed: CorvalaPayload[] = [
  ...[100, 98, 94].map((h, i) => msg("SHP-1042", [10, 20, 30][i], h)),
  ...[150, 148, 140].map((h, i) => msg("SHP-1043", [10, 20, 30][i], h)),
  msg("SHP-1044", 10, 5),
  msg("SHP-1044", 20, 4),
  ...[60, 58, 54].map((h, i) => msg("SHP-1045", [10, 20, 30][i], h)),
  ...[60, 58, 52].map((h, i) => msg("SHP-1046", [10, 20, 30][i], h)),
  ...[50, 48, 44].map((h, i) => msg("SHP-1048", [10, 20, 30][i], h)),
  msg("SHP-1049", 10, 30),
  msg("SHP-1049", 20, 28),
  // Still on the road: a repeat update that came with the operator's later ETA.
  { shipment_ref: "SHP-1049", status_code: 20, ts: minutesAgo(40) },
];

function msg(ref: string, code: number, hours: number): CorvalaPayload {
  return { shipment_ref: ref, status_code: code, ts: hoursAgo(hours) };
}

/** Examples for the adapter tests, including a code we don't know. */
export const corvalaSamples: CorvalaPayload[] = [
  { shipment_ref: "SHP-1042", status_code: 10, ts: hoursAgo(100) },
  { shipment_ref: "SHP-1042", status_code: 20, ts: hoursAgo(98) },
  { shipment_ref: "SHP-1042", status_code: 30, ts: hoursAgo(94) },
  // A code Corvala added without telling us: read as unknown, sent to ops for review.
  { shipment_ref: "SHP-1044", status_code: 45, ts: hoursAgo(4) },
];
