/** Operator emails for the seed shipments, read by the simulated AI (`lib/ai/normalizeText.ts`). */
import type { OperatorEmail } from "@/lib/normalize/email";
import { minutesAgo } from "@/lib/time";

export const operatorEmails: OperatorEmail[] = [
  {
    // Read as a customs hold (0.9). Critical, and already past its 30-minute response target:
    // tops the ops inbox.
    ref: "SHP-1043",
    operatorId: "op-saltwren",
    receivedAt: minutesAgo(40),
    subject: "RE: SHP-1043 container status",
    body: "Hi, the container is held by UK customs at Southampton pending the packing list. Will advise.",
  },
];
