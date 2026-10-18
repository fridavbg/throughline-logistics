/**
 * Corvala Transport (road): JSON with numeric status codes and ISO timestamps.
 * Example: `{ "shipment_ref": "SHP-1042", "status_code": 30, "ts": "2026-10-17T08:15:00+02:00" }`
 */
import { parseOperatorTime } from "@/lib/normalize/parseTime";
import type { MilestoneType, NormalizedEvent } from "@/lib/types";

/** One status message as Corvala sends it. */
export type CorvalaPayload = { shipment_ref: string; status_code: number; ts: string };

const CODES: Record<number, MilestoneType> = {
  10: "picked_up",
  20: "in_transit",
  30: "delivered",
};

/**
 * Reads a Corvala message. Known codes are certain (confidence 1). An unknown code can't
 * be read, so it becomes `null` with confidence 0 and goes to ops for review.
 */
export function normalizeCorvala(payload: CorvalaPayload): NormalizedEvent {
  const milestone = CODES[payload.status_code] ?? null;
  return {
    shipmentId: payload.shipment_ref,
    event: {
      operatorId: "op-corvala",
      receivedAt: parseOperatorTime(payload.ts, "Corvala"),
      channel: "api",
      original: JSON.stringify(payload),
      normalizedTo: milestone,
      confidence: milestone === null ? 0 : 1,
    },
  };
}
