/**
 * Operator emails. Reading free-form email is AI work (A1, unstructured), planned for #19
 * and outside the time budget, so the seed emails carry their reading already: the
 * milestone they report and how confident that reading is.
 */
import { parseOperatorTime } from "@/lib/normalize/parseTime";
import type { MilestoneType, NormalizedEvent } from "@/lib/types";

/** An email from an operator, with its (precomputed) reading. */
export type OperatorEmail = {
  ref: string;
  operatorId: string;
  receivedAt: string;
  subject: string;
  body: string;
  reading: { milestone: MilestoneType | null; confidence: number };
};

/** Turns an operator email into an event, keeping the full text for ops. */
export function normalizeEmail(email: OperatorEmail): NormalizedEvent {
  return {
    shipmentId: email.ref,
    event: {
      operatorId: email.operatorId,
      receivedAt: parseOperatorTime(email.receivedAt, "Operator email"),
      channel: "email",
      original: `Subject: ${email.subject}\n${email.body}`,
      normalizedTo: email.reading.milestone,
      confidence: email.reading.confidence,
    },
  };
}
