/**
 * Sample Corvala Transport messages, as their API sends them (docs/DATA_MODEL.md §6).
 * The feeds behind each seed shipment are added with the seed scenarios (#8).
 */
import type { CorvalaPayload } from "@/lib/normalize/corvala";
import { hoursAgo } from "@/lib/time";

export const corvalaSamples: CorvalaPayload[] = [
  { shipment_ref: "SHP-1042", status_code: 10, ts: hoursAgo(100) },
  { shipment_ref: "SHP-1042", status_code: 20, ts: hoursAgo(98) },
  { shipment_ref: "SHP-1042", status_code: 30, ts: hoursAgo(94) },
  // A code Corvala added without telling us: read as unknown, sent to ops for review.
  { shipment_ref: "SHP-1044", status_code: 45, ts: hoursAgo(4) },
];
