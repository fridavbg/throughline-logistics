/**
 * Turns an AI confidence score into the level the UI shows. Spec: docs/DESIGN.md §6
 * (ConfidenceMeter). Kept here so no component compares confidence numbers itself.
 */
import type { ConfidenceLevel } from "@/lib/types";

/** From this confidence up, an AI output is High: firm enough to alert a customer. */
export const HIGH_CONFIDENCE = 0.8;

/** Below this confidence, an AI output needs a person to review it before it's trusted. */
export const REVIEW_BELOW = 0.6;

/**
 * The level for a confidence between 0 and 1, e.g. `confidenceLevel(0.82)` is "high".
 * A score that isn't a number between 0 and 1 counts as "needs_review", so bad data is
 * never shown as a confident answer.
 */
export function confidenceLevel(confidence: number): ConfidenceLevel {
  const valid = confidence >= 0 && confidence <= 1; // false for NaN too
  if (!valid || confidence < REVIEW_BELOW) return "needs_review";
  if (confidence >= HIGH_CONFIDENCE) return "high";
  return "medium";
}
