/**
 * The demo's shipments: each booking with its operator events read by the matching adapter.
 * This is the single entry point for shipment data. Views get shipments from here (through
 * the store), never from data/raw, so swapping in a database later changes only this file.
 */
import { normalizeCorvala } from "@/lib/normalize/corvala";
import { normalizeEmail } from "@/lib/normalize/email";
import { normalizeQuickfern } from "@/lib/normalize/quickfern";
import { normalizeSaltwren } from "@/lib/normalize/saltwren";
import { applyEvents } from "@/lib/shipments";
import type { NormalizedEvent, Shipment } from "@/lib/types";
import { getBookings } from "./bookings";
import { corvalaFeed } from "./raw/corvala";
import { operatorEmails } from "./raw/email";
import { quickfernFeed } from "./raw/quickfern";
import { saltwrenFeed } from "./raw/saltwren";

/** Every operator event for the seed shipments, read by its operator's adapter. */
export function getOperatorEvents(): NormalizedEvent[] {
  return [
    ...corvalaFeed.map(normalizeCorvala),
    ...saltwrenFeed.map(normalizeSaltwren),
    ...quickfernFeed.map(normalizeQuickfern),
    ...operatorEmails.map(normalizeEmail),
  ];
}

/**
 * Every shipment, normalized and up to date with all its operator events. `demoEvents` are
 * extra operator events from the demo panel (F6), applied on top of the seed feeds; leaving
 * them out gives the seed state, which is how "Reset demo" works.
 */
export function getShipments(demoEvents: NormalizedEvent[] = []): Shipment[] {
  const events = [...getOperatorEvents(), ...demoEvents];
  return getBookings().map((booking) => applyEvents(booking, events));
}
