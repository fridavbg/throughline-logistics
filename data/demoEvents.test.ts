// The demo panel's events (F6): what the seed shows before each one, and what changes after.
// Everything after an event is recomputed from the shipments, so these tests run the same
// functions the views use.
import { describe, expect, it } from "vitest";
import { demoEvents, eventsFor, type DemoEventId } from "@/data/demoEvents";
import { getShipments } from "@/data/shipments";
import { predictEta } from "@/lib/ai/eta";
import { customerAlerts, customerShipments } from "@/lib/customer";
import { getShipmentStatus, isStale } from "@/lib/derived";
import { detectExceptions } from "@/lib/exceptions";
import { DEMO_NOW } from "@/lib/time";
import type { Shipment } from "@/lib/types";

function shipment(id: string, applied: DemoEventId[] = []): Shipment {
  const s = getShipments(eventsFor(applied)).find((x) => x.id === id);
  if (!s) throw new Error(`Missing seed shipment ${id}`);
  return s;
}

const exceptionTypes = (s: Shipment) => detectExceptions(s, DEMO_NOW).map((e) => e.type);
const alertIds = (s: Shipment) => customerAlerts(customerShipments([s], DEMO_NOW)).map((a) => a.shipmentId);

describe("demo events", () => {
  it("each targets the shipment it names, with operator events for that shipment only", () => {
    for (const e of demoEvents) {
      expect(e.events.length, e.id).toBeGreaterThan(0);
      expect(e.events.every((n) => n.shipmentId === e.shipmentId), e.id).toBe(true);
    }
  });

  it("gives the seed state when no event is applied, which is what Reset demo relies on", () => {
    expect(getShipments(eventsFor([]))).toEqual(getShipments());
  });

  it("gives the same shipments whatever order the events are triggered in", () => {
    const ids: DemoEventId[] = ["vessel-delayed", "email-update", "delivery-confirmed"];
    expect(getShipments(eventsFor([...ids].reverse()))).toEqual(getShipments(eventsFor(ids)));
  });
});

describe("Vessel delayed at Valencia (SHP-1042)", () => {
  it("before: at port, fresh, on time, with no exception or customer alert", () => {
    const s = shipment("SHP-1042");
    expect(getShipmentStatus(s)).toBe("at_port");
    expect(isStale(s, DEMO_NOW)).toBe(false);
    expect(predictEta(s, DEMO_NOW)).toBeUndefined();
    expect(exceptionTypes(s)).toEqual([]);
    expect(alertIds(s)).toEqual([]);
  });

  it("after: departed 26h late, AI predicts late, the customer is alerted and ops gets a delay", () => {
    const s = shipment("SHP-1042", ["vessel-delayed"]);
    expect(getShipmentStatus(s)).toBe("in_transit");
    expect(predictEta(s, DEMO_NOW)?.reason).toBe("Vessel departed 26h late from Port of Valencia");
    expect(exceptionTypes(s)).toEqual(["delay"]);
    expect(alertIds(s)).toEqual(["SHP-1042"]);
  });
});

describe("Email update received (SHP-1048)", () => {
  it("before: no email and nothing to review", () => {
    const s = shipment("SHP-1048");
    expect(s.rawEvents.some((e) => e.channel === "email")).toBe(false);
    expect(exceptionTypes(s)).toEqual([]);
  });

  it("after: the vague email is kept but doesn't move the timeline; ops must review it", () => {
    const before = shipment("SHP-1048");
    const after = shipment("SHP-1048", ["email-update"]);
    expect(after.legs).toEqual(before.legs);
    expect(after.rawEvents.at(-1)?.confidence).toBe(0.45);
    expect(exceptionTypes(after)).toEqual(["needs_review"]);
  });
});

describe("Delivery confirmed (SHP-1044)", () => {
  it("before: on the road", () => {
    expect(getShipmentStatus(shipment("SHP-1044"))).toBe("in_transit");
  });

  it("after: delivered, with no exception left", () => {
    const s = shipment("SHP-1044", ["delivery-confirmed"]);
    expect(getShipmentStatus(s)).toBe("delivered");
    expect(exceptionTypes(s)).toEqual([]);
  });
});
