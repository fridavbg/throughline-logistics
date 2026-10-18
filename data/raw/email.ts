/** Operator emails for the seed shipments, with their precomputed reading (see #19). */
import type { OperatorEmail } from "@/lib/normalize/email";
import { minutesAgo } from "@/lib/time";

export const operatorEmails: OperatorEmail[] = [
  {
    // Critical, and already past its 30-minute response target: tops the ops inbox.
    ref: "SHP-1043",
    operatorId: "op-saltwren",
    receivedAt: minutesAgo(40),
    subject: "RE: SHP-1043 container status",
    body: "Hi, the container is held by UK customs at Southampton pending the packing list. Will advise.",
    reading: { milestone: "customs_hold", confidence: 0.82 },
  },
  {
    // Too vague to act on (0.45): it doesn't change the timeline and goes to ops for review.
    ref: "SHP-1048",
    operatorId: "op-saltwren",
    receivedAt: minutesAgo(15),
    subject: "SHP-1048 schedule",
    body: "Hi, the vessel might call at Rotterdam a day early, depending on berth availability. Will confirm.",
    reading: { milestone: "arrived", confidence: 0.45 },
  },
];
