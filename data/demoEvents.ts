/**
 * The demo panel's scripted events (F6). Each one is raw operator data in that operator's own
 * format, read by the same adapter as the seed feeds, so a simulated event travels exactly
 * the path a real one would. Times are relative to the fixed demo clock.
 */
import { normalizeCorvala } from "@/lib/normalize/corvala";
import { normalizeEmail } from "@/lib/normalize/email";
import { normalizeSaltwren } from "@/lib/normalize/saltwren";
import { hoursAgo, minutesAgo } from "@/lib/time";
import type { NormalizedEvent } from "@/lib/types";
import { ediLine } from "./raw/saltwren";

export type DemoEventId = "vessel-delayed" | "email-update" | "delivery-confirmed";

/** One button in the demo panel and the operator messages it delivers. */
export type DemoEvent = {
  id: DemoEventId;
  /** The button text, e.g. "Vessel delayed at Valencia". */
  label: string;
  shipmentId: string;
  /** What the event should show, for whoever runs the demo. */
  effect: string;
  events: NormalizedEvent[];
};

export const demoEvents: DemoEvent[] = [
  {
    id: "vessel-delayed",
    label: "Vessel delayed at Valencia",
    shipmentId: "SHP-1042",
    effect: "Loaded and departed 26h late. AI predicts late: customer alert and ops exception.",
    // Planned 30 and 27 hours ago; the operator's ETA stays unchanged.
    events: [
      ediLine("SHP-1042", "LOD", "ESVLC", hoursAgo(4)),
      ediLine("SHP-1042", "DEP", "ESVLC", hoursAgo(1)),
    ].map(normalizeSaltwren),
  },
  {
    id: "email-update",
    label: "Email update received",
    shipmentId: "SHP-1048",
    effect: "A vague email read with low confidence (0.45): ops must review it.",
    // Too vague to act on: it doesn't change the timeline and goes to ops for review.
    events: [
      normalizeEmail({
        ref: "SHP-1048",
        operatorId: "op-saltwren",
        receivedAt: minutesAgo(15),
        subject: "SHP-1048 schedule",
        body: "Hi, the vessel might call at Rotterdam a day early, depending on berth availability. Will confirm.",
        reading: { milestone: "arrived", confidence: 0.45 },
      }),
    ],
  },
  {
    id: "delivery-confirmed",
    label: "Delivery confirmed",
    shipmentId: "SHP-1044",
    effect: "Delivered about 3h ahead of plan: the timeline and status show it delivered.",
    events: [normalizeCorvala({ shipment_ref: "SHP-1044", status_code: 30, ts: minutesAgo(10) })],
  },
];

/** The operator events delivered by the given demo events, in the order given. */
export function eventsFor(ids: DemoEventId[]): NormalizedEvent[] {
  return ids.flatMap((id) => demoEvents.find((e) => e.id === id)?.events ?? []);
}
