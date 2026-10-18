/**
 * Corvala Transport messages, as their API sends them (docs/DATA_MODEL.md §6):
 * samples for the adapter tests, and the feed behind the seed shipments.
 */
import type { CorvalaPayload } from "@/lib/normalize/corvala";
import { hoursAgo, minutesAgo } from "@/lib/time";

/** Messages that build the seed scenarios (docs/DATA_MODEL.md §7). */
export const corvalaFeed: CorvalaPayload[] = [
  ...roadEvents("SHP-1042", [100, 98, 94]),
  ...roadEvents("SHP-1043", [150, 148, 140]),
  msg("SHP-1044", 10, 5),
  msg("SHP-1044", 20, 4),
  ...roadEvents("SHP-1045", [60, 58, 54]),
  ...roadEvents("SHP-1046", [60, 58, 52]),
  ...roadEvents("SHP-1048", [50, 48, 44]),
  msg("SHP-1049", 10, 30),
  msg("SHP-1049", 20, 28),
  // Still on the road: a repeat update that came with the operator's later ETA.
  { shipment_ref: "SHP-1049", status_code: 20, ts: minutesAgo(40) },
];

function msg(ref: string, code: number, hours: number): CorvalaPayload {
  return { shipment_ref: ref, status_code: code, ts: hoursAgo(hours) };
}

/** A finished road leg: picked up (10), in transit (20) and delivered (30), each `hours` ago. */
function roadEvents(
  ref: string,
  [pickedUp, inTransit, delivered]: [number, number, number],
): CorvalaPayload[] {
  return [msg(ref, 10, pickedUp), msg(ref, 20, inTransit), msg(ref, 30, delivered)];
}

/** Examples for the adapter tests, including a code we don't know. */
export const corvalaSamples: CorvalaPayload[] = [
  { shipment_ref: "SHP-1042", status_code: 10, ts: hoursAgo(100) },
  { shipment_ref: "SHP-1042", status_code: 20, ts: hoursAgo(98) },
  { shipment_ref: "SHP-1042", status_code: 30, ts: hoursAgo(94) },
  // A code Corvala added without telling us: read as unknown, sent to ops for review.
  { shipment_ref: "SHP-1044", status_code: 45, ts: hoursAgo(4) },
];
