/** Shipment fixtures for tests. */
import { eventsFor } from "./demoEvents";
import { getShipments } from "./shipments";
import type { Shipment } from "@/lib/types";

/**
 * The shipments mid-demo, after "Vessel delayed at Valencia" and "Email update received"
 * (README walkthrough): every exception type the demo shows is in play, and SHP-1044 is
 * still on the road. Tests of lib/ logic use this rather than the seed alone, which has no
 * delay alert or review item until the demo panel adds them.
 */
export function getMidDemoShipments(): Shipment[] {
  return getShipments(eventsFor(["vessel-delayed", "email-update"]));
}
