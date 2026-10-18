/**
 * Quickfern free-text messages (docs/DATA_MODEL.md §6): samples for the adapter tests, and
 * the feed behind the seed shipments.
 */
import type { QuickfernPayload } from "@/lib/normalize/quickfern";
import { hoursAgo, minutesAgo } from "@/lib/time";

/** Messages that build the seed scenarios (docs/DATA_MODEL.md §7). */
export const quickfernFeed: QuickfernPayload[] = [
  { ref: "SHP-1047", update: "Collected at Zaragoza Warehouse", time: hoursAgo(30) },
  { ref: "SHP-1047", update: "On the way to Murcia", time: hoursAgo(28) },
  { ref: "SHP-1047", update: "Delivered - signed by R. Gomez", time: minutesAgo(16 * 60 + 20) },
];

/** Examples for the adapter tests, including text we can't read. */
export const quickfernSamples: QuickfernPayload[] = [
  ...quickfernFeed,
  // Free text we can't read with confidence: sent to ops for review.
  { ref: "SHP-1047", update: "Driver called, will update", time: hoursAgo(29) },
];
