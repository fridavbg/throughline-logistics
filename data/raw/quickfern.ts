/**
 * Sample Quickfern free-text messages (docs/DATA_MODEL.md §6).
 * The feeds behind each seed shipment are added with the seed scenarios (#8).
 */
import type { QuickfernPayload } from "@/lib/normalize/quickfern";
import { hoursAgo, minutesAgo } from "@/lib/time";

export const quickfernSamples: QuickfernPayload[] = [
  { ref: "SHP-1047", update: "Collected at Zaragoza Warehouse", time: hoursAgo(30) },
  { ref: "SHP-1047", update: "On the way to Murcia", time: hoursAgo(28) },
  { ref: "SHP-1047", update: "Delivered - signed by R. Gomez", time: minutesAgo(16 * 60 + 20) },
  // Free text we can't read with confidence: sent to ops for review.
  { ref: "SHP-1047", update: "Driver called, will update", time: hoursAgo(29) },
];
