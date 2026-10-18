/**
 * Quickfern (road, last mile): JSON with a free-text English status.
 * Example: `{ "ref": "SHP-1047", "update": "Delivered - signed by R. Gomez", "time": "…" }`
 */
import type { MilestoneType, NormalizedEvent } from "@/lib/types";

/** One status message as Quickfern sends it. */
export type QuickfernPayload = { ref: string; update: string; time: string };

// Checked in order, so "delivered" wins over "on the way" in a mixed message.
const KEYWORDS: [string, MilestoneType][] = [
  ["delivered", "delivered"],
  ["picked up", "picked_up"],
  ["collected", "picked_up"],
  ["in transit", "in_transit"],
  ["on the way", "in_transit"],
  ["out for delivery", "in_transit"],
];

// Words that mean something did NOT happen. "Not delivered" contains "delivered", so without
// this check a failed delivery would show as delivered.
const NOT_HAPPENED = ["not ", "n't", "failed", "unable", "attempt", "missed"];

/** Free text is matched by keywords, so even a match is less certain than a status code. */
const KEYWORD_CONFIDENCE = 0.9;
const UNKNOWN_CONFIDENCE = 0.2;

/**
 * Reads a Quickfern message by keyword. Text without a known keyword, or that says
 * something didn't happen, becomes `null` with low confidence, for a person to review.
 */
export function normalizeQuickfern(payload: QuickfernPayload): NormalizedEvent {
  const text = payload.update.toLowerCase();
  const negated = NOT_HAPPENED.some((word) => text.includes(word));
  const match = negated ? undefined : KEYWORDS.find(([keyword]) => text.includes(keyword));
  return {
    shipmentId: payload.ref,
    event: {
      operatorId: "op-quickfern",
      receivedAt: new Date(payload.time).toISOString(),
      channel: "api",
      original: JSON.stringify(payload),
      normalizedTo: match ? match[1] : null,
      confidence: match ? KEYWORD_CONFIDENCE : UNKNOWN_CONFIDENCE,
    },
  };
}
