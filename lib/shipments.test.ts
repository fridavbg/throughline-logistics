import { describe, expect, it } from "vitest";
import { applyEvents } from "@/lib/shipments";
import type { Leg, MilestoneType, NormalizedEvent, Shipment } from "@/lib/types";

const port = { name: "Port of Valencia", country: "ES", kind: "port" } as const;

function leg(sequence: number, operatorId: string, types: MilestoneType[]): Leg {
  return {
    sequence,
    mode: operatorId === "op-saltwren" ? "sea" : "road",
    operatorId,
    from: port,
    to: port,
    milestones: types.map((type, i) => ({
      type,
      at: null,
      plannedAt: `2026-10-1${sequence}T0${i}:00:00.000Z`,
      source: "estimated",
    })),
  };
}

function booking(legs: Leg[]): Shipment {
  return {
    id: "SHP-TEST",
    customerId: "cust-ostrel-de",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: false,
    legs,
    operatorEta: { date: "2026-10-25T00:00:00.000Z", source: "estimated" },
    plannedEta: "2026-10-25T00:00:00.000Z",
    documents: [],
    rawEvents: [],
  };
}

function event(
  operatorId: string,
  type: MilestoneType | null,
  receivedAt: string,
  confidence = 1,
  shipmentId = "SHP-TEST",
): NormalizedEvent {
  return {
    shipmentId,
    event: { operatorId, receivedAt, channel: "api", original: `${type} at ${receivedAt}`, normalizedTo: type, confidence },
  };
}

const roadSeaRoad = () =>
  booking([
    leg(1, "op-corvala", ["picked_up", "in_transit", "delivered"]),
    leg(2, "op-saltwren", ["gate_in", "loaded", "departed", "arrived", "discharged"]),
    leg(3, "op-corvala", ["picked_up", "in_transit", "delivered"]),
  ]);

describe("applyEvents", () => {
  it("completes the planned step on the operator's leg and keeps the original as rawStatus", () => {
    const s = applyEvents(roadSeaRoad(), [event("op-saltwren", "departed", "2026-10-18T09:00:00.000Z")]);
    const departed = s.legs[1]?.milestones.find((m) => m.type === "departed");

    expect(departed).toMatchObject({
      at: "2026-10-18T09:00:00.000Z",
      source: "confirmed",
      rawStatus: "departed at 2026-10-18T09:00:00.000Z",
    });
    expect(s.rawEvents).toHaveLength(1);
  });

  it("completes one leg only when the operator runs two legs", () => {
    const s = applyEvents(roadSeaRoad(), [event("op-corvala", "picked_up", "2026-10-11T08:00:00.000Z")]);

    expect(s.legs[0]?.milestones[0]?.at).toBe("2026-10-11T08:00:00.000Z");
    expect(s.legs[2]?.milestones[0]?.at).toBeNull();
  });

  it("moves on to the operator's next leg once their leg in progress is finished", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-corvala", "picked_up", "2026-10-11T08:00:00.000Z"),
      event("op-corvala", "in_transit", "2026-10-11T09:00:00.000Z"),
      event("op-corvala", "delivered", "2026-10-11T12:00:00.000Z"),
      event("op-corvala", "picked_up", "2026-10-24T08:00:00.000Z"),
    ]);

    expect(s.legs[2]?.milestones[0]?.at).toBe("2026-10-24T08:00:00.000Z");
  });

  it("treats a repeat 'in transit' on the leg in progress as a repeat, not the next leg's step", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-corvala", "picked_up", "2026-10-11T08:00:00.000Z"),
      event("op-corvala", "in_transit", "2026-10-11T09:00:00.000Z"),
      event("op-corvala", "in_transit", "2026-10-11T11:00:00.000Z"),
    ]);

    expect(s.legs[0]?.milestones[1]?.at).toBe("2026-10-11T09:00:00.000Z");
    expect(s.legs[2]?.milestones.every((m) => m.at === null)).toBe(true);
  });

  it("keeps a low-confidence event for review without changing the timeline", () => {
    const s = applyEvents(roadSeaRoad(), [event("op-saltwren", "arrived", "2026-10-18T09:00:00.000Z", 0.45)]);

    expect(s.legs.every((l) => l.milestones.every((m) => m.at === null))).toBe(true);
    expect(s.rawEvents).toHaveLength(1);
  });

  it("keeps an unreadable event for review", () => {
    const s = applyEvents(roadSeaRoad(), [event("op-saltwren", null, "2026-10-18T09:00:00.000Z", 0)]);

    expect(s.rawEvents).toHaveLength(1);
  });

  it("adds an unplanned customs hold to the leg the operator is working on, in time order", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-saltwren", "discharged", "2026-10-12T04:00:00.000Z"),
      event("op-saltwren", "customs_hold", "2026-10-12T06:00:00.000Z", 0.82),
    ]);
    const types = s.legs[1]?.milestones.map((m) => m.type);

    expect(types?.at(-1)).toBe("customs_hold");
    expect(s.legs[1]?.milestones.at(-1)?.at).toBe("2026-10-12T06:00:00.000Z");
  });

  it("ignores a repeat of a step that already happened, but keeps the message", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-saltwren", "departed", "2026-10-18T09:00:00.000Z"),
      event("op-saltwren", "departed", "2026-10-18T21:00:00.000Z"),
    ]);

    expect(s.legs[1]?.milestones.find((m) => m.type === "departed")?.at).toBe("2026-10-18T09:00:00.000Z");
    expect(s.rawEvents).toHaveLength(2);
  });

  it("stores an exact duplicate message only once", () => {
    const twice = event("op-saltwren", "departed", "2026-10-18T09:00:00.000Z");
    const s = applyEvents(roadSeaRoad(), [twice, twice]);

    expect(s.rawEvents).toHaveLength(1);
  });

  it("ignores events for other shipments", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-saltwren", "departed", "2026-10-18T09:00:00.000Z", 1, "SHP-OTHER"),
    ]);

    expect(s.rawEvents).toHaveLength(0);
    expect(s.legs[1]?.milestones.every((m) => m.at === null)).toBe(true);
  });

  it("applies events in time order, whatever order they arrive in", () => {
    const s = applyEvents(roadSeaRoad(), [
      event("op-corvala", "picked_up", "2026-10-24T08:00:00.000Z"),
      event("op-corvala", "picked_up", "2026-10-11T08:00:00.000Z"),
    ]);

    expect(s.legs[0]?.milestones[0]?.at).toBe("2026-10-11T08:00:00.000Z");
    expect(s.rawEvents.map((e) => e.receivedAt)).toEqual(["2026-10-11T08:00:00.000Z", "2026-10-24T08:00:00.000Z"]);
  });

  it("ignores an event from an operator with no leg on this shipment", () => {
    const s = applyEvents(roadSeaRoad(), [event("op-quickfern", "delivered", "2026-10-24T08:00:00.000Z")]);

    expect(s.legs.every((l) => l.milestones.every((m) => m.at === null))).toBe(true);
    expect(s.rawEvents).toHaveLength(1);
  });
});
