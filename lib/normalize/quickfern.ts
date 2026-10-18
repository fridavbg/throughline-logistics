/**
 * Quickfern (road, last mile): JSON with a free-text English status.
 * Example: `{ "ref": "SHP-1047", "update": "Delivered - signed by R. Gomez", "time": "…" }`
 */
import { parseOperatorTime } from "@/lib/normalize/parseTime";
import type { MilestoneType, NormalizedEvent } from "@/lib/types";

/** One status message as Quickfern sends it. */
export type QuickfernPayload = { ref: string; update: string; time: string };

// Checked from the furthest step back, so a message naming several steps
// ("Picked up, out for delivery") is read as the furthest one.
const KEYWORDS: [string, MilestoneType][] = [
  ["delivered", "delivered"],
  ["in transit", "in_transit"],
  ["on the way", "in_transit"],
  ["out for delivery", "in_transit"],
  ["picked up", "picked_up"],
  ["collected", "picked_up"],
];

// Words that mean something did NOT happen. "Not delivered" and "undelivered" both contain
// "delivered", so without this check a failed delivery would show as delivered. Erring this
// way is safe: a false alarm only sends the message to a person for review.
const NOT_HAPPENED = ["not ", "n't", "undeliver", "failed", "unable", "attempt", "missed", "return"];

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
      receivedAt: parseOperatorTime(payload.time, "Quickfern"),
      channel: "api",
      original: JSON.stringify(payload),
      normalizedTo: match ? match[1] : null,
      confidence: match ? KEYWORD_CONFIDENCE : UNKNOWN_CONFIDENCE,
    },
  };
}
