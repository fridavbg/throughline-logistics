/**
 * Operator emails. The text is read by the simulated AI in `lib/ai/normalizeText.ts` (A1,
 * unstructured): the step it reports, how confident that reading is, and why.
 */
import { readEmail } from "@/lib/ai/normalizeText";
import { parseOperatorTime } from "@/lib/normalize/parseTime";
import type { NormalizedEvent } from "@/lib/types";

/** An email from an operator, as received. */
export type OperatorEmail = {
  ref: string;
  operatorId: string;
  receivedAt: string;
  subject: string;
  body: string;
};

/** Turns an operator email into an event, keeping the full text and the reading's reason for ops. */
export function normalizeEmail(email: OperatorEmail): NormalizedEvent {
  const reading = readEmail(email.subject, email.body);
  return {
    shipmentId: email.ref,
    event: {
      operatorId: email.operatorId,
      receivedAt: parseOperatorTime(email.receivedAt, "Operator email"),
      channel: "email",
      original: `Subject: ${email.subject}\n${email.body}`,
      normalizedTo: reading.milestone,
      confidence: reading.confidence,
      readingNote: reading.note,
    },
  };
}
