import { describe, expect, it } from "vitest";
import {
  getCurrentLeg,
  getEtaStatus,
  getLastUpdateAt,
  getShipmentStatus,
  isOverdue,
  isStale,
} from "@/lib/derived";
import type { EtaPrediction, Leg, MilestoneType, RawEventRef, Shipment, ShipmentException } from "@/lib/types";

const port = { name: "Port of Valencia", country: "ES", kind: "port" } as const;
const NOW = new Date("2026-10-21T08:00:00.000Z");

/** A leg whose steps are given as [type, when it happened or null]. */
function leg(sequence: number, steps: [MilestoneType, string | null][]): Leg {
  return {
    sequence,
    mode: "road",
    operatorId: "op-corvala",
    from: port,
    to: port,
    milestones: steps.map(([type, at], i) => ({
      type,
      at,
      plannedAt: `2026-10-1${sequence}T0${i}:00:00.000Z`,
      source: "confirmed",
    })),
  };
}

function shipment(legs: Leg[], overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "SHP-TEST",
    customerId: "cust-ostrel-de",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: true,
    legs,
    operatorEta: { date: "2026-10-25T00:00:00.000Z", source: "estimated" },
    plannedEta: "2026-10-25T00:00:00.000Z",
    documents: [],
    rawEvents: [],
    ...overrides,
  };
}

function rawEvent(receivedAt: string): RawEventRef {
  return { operatorId: "op-corvala", receivedAt, channel: "api", original: "x", normalizedTo: null, confidence: 1 };
}

const road = (picked: string | null, transit: string | null, delivered: string | null, sequence = 1) =>
  leg(sequence, [["picked_up", picked], ["in_transit", transit], ["delivered", delivered]]);

describe("getShipmentStatus", () => {
  it("is planned before any step has happened", () => {
    expect(getShipmentStatus(shipment([road(null, null, null)]))).toBe("planned");
  });

  it("is in transit once the truck has left", () => {
    expect(getShipmentStatus(shipment([road("2026-10-11T08:00:00Z", null, null)]))).toBe("in_transit");
  });

  it("is at port, not delivered, when the first leg delivers to the port", () => {
    const s = shipment([road("2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z", "2026-10-11T12:00:00Z"), road(null, null, null, 2)]);
    expect(getShipmentStatus(s)).toBe("at_port");
  });

  it("is delivered when the last leg delivers", () => {
    const s = shipment([
      road("2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z", "2026-10-11T12:00:00Z"),
      road("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", "2026-10-12T12:00:00Z", 2),
    ]);
    expect(getShipmentStatus(s)).toBe("delivered");
  });

  it("is at port after the vessel discharges", () => {
    const sea = leg(1, [["departed", "2026-10-11T08:00:00Z"], ["arrived", "2026-10-13T08:00:00Z"], ["discharged", "2026-10-13T12:00:00Z"]]);
    expect(getShipmentStatus(shipment([sea]))).toBe("at_port");
  });

  it("stays on customs hold while the hold is unresolved, even after a later step", () => {
    const s = shipment([
      leg(1, [["discharged", "2026-10-13T08:00:00Z"], ["customs_hold", "2026-10-13T10:00:00Z"], ["customs_cleared", null]]),
      road("2026-10-14T08:00:00Z", null, null, 2),
    ]);
    expect(getShipmentStatus(s)).toBe("customs_hold");
  });

  it("is no longer on customs hold once customs clears it", () => {
    const s = shipment([
      leg(1, [["customs_hold", "2026-10-13T10:00:00Z"], ["customs_cleared", "2026-10-13T15:00:00Z"]]),
    ]);
    expect(getShipmentStatus(s)).toBe("at_port");
  });

  it("is on customs hold again after a second hold", () => {
    const s = shipment([
      leg(1, [
        ["customs_hold", "2026-10-13T10:00:00Z"],
        ["customs_cleared", "2026-10-13T15:00:00Z"],
        ["customs_hold", "2026-10-13T18:00:00Z"],
      ]),
    ]);
    expect(getShipmentStatus(s)).toBe("customs_hold");
  });

  it("goes by the route, not the order steps are listed in", () => {
    const inOrder = leg(1, [["arrived", "2026-10-13T08:00:00Z"], ["discharged", "2026-10-13T12:00:00Z"], ["picked_up", "2026-10-14T08:00:00Z"]]);
    const shuffled = { ...inOrder, milestones: [...inOrder.milestones].reverse() };
    expect(getShipmentStatus(shipment([shuffled]))).toBe(getShipmentStatus(shipment([inOrder])));
    expect(getShipmentStatus(shipment([shuffled]))).toBe("in_transit");
  });

  it("stays delivered when an earlier leg's missed step is reported late", () => {
    // The sea leg's discharge arrives after the truck delivered, so its `at` is the newest.
    const s = shipment([
      leg(1, [["arrived", null], ["discharged", "2026-10-15T12:00:00Z"]]),
      road("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", "2026-10-12T12:00:00Z", 2),
    ]);
    expect(getShipmentStatus(s)).toBe("delivered");
  });

  it("counts a hold as resolved when customs cleared after it, whatever the planned order", () => {
    // Customs cleared after the hold, although the hold was listed (planned) later.
    const s = shipment([leg(1, [["customs_cleared", "2026-10-13T15:00:00Z"], ["customs_hold", "2026-10-13T10:00:00Z"]])]);
    expect(getShipmentStatus(s)).toBe("at_port");
  });
});

describe("getCurrentLeg", () => {
  const legs = (first: Leg, second: Leg) => shipment([first, second]);

  it("is the first leg before anything has happened", () => {
    expect(getCurrentLeg(legs(road(null, null, null), road(null, null, null, 2)))?.sequence).toBe(1);
  });

  it("moves to the next leg once every step on the leg is done", () => {
    const s = legs(road("2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z", "2026-10-11T12:00:00Z"), road(null, null, null, 2));
    expect(getCurrentLeg(s)?.sequence).toBe(2);
  });

  it("isn't held back by a step the operator never reported", () => {
    const s = legs(road("2026-10-11T08:00:00Z", null, "2026-10-11T12:00:00Z"), road("2026-10-12T08:00:00Z", null, null, 2));
    expect(getCurrentLeg(s)?.sequence).toBe(2);
  });

  it("is the last leg once everything is done", () => {
    const s = legs(
      road("2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z", "2026-10-11T12:00:00Z"),
      road("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", "2026-10-12T12:00:00Z", 2),
    );
    expect(getCurrentLeg(s)?.sequence).toBe(2);
  });
});

describe("getLastUpdateAt", () => {
  it("is the newest of several events", () => {
    const s = shipment([], { rawEvents: [rawEvent("2026-10-11T08:00:00.000Z"), rawEvent("2026-10-12T08:00:00.000Z")] });
    expect(getLastUpdateAt(s)).toBe("2026-10-12T08:00:00.000Z");
  });

  it("finds the newest when events are out of order", () => {
    const s = shipment([], { rawEvents: [rawEvent("2026-10-12T08:00:00.000Z"), rawEvent("2026-10-11T08:00:00.000Z")] });
    expect(getLastUpdateAt(s)).toBe("2026-10-12T08:00:00.000Z");
  });

  it("compares moments, not text, when time zones differ", () => {
    // 10:00 in Spain is 08:00 UTC, so the UTC event at 09:00 is newer.
    const s = shipment([], { rawEvents: [rawEvent("2026-10-12T10:00:00+02:00"), rawEvent("2026-10-12T09:00:00Z")] });
    expect(getLastUpdateAt(s)).toBe("2026-10-12T09:00:00Z");
  });

  it("is null before the operator has reported", () => {
    expect(getLastUpdateAt(shipment([]))).toBeNull();
  });
});

describe("isStale", () => {
  const moving = (lastUpdate: string) =>
    shipment([road("2026-10-19T08:00:00Z", null, null)], { rawEvents: [rawEvent(lastUpdate)] });

  it("is not stale at exactly 24 hours without an update", () => {
    expect(isStale(moving("2026-10-20T08:00:00.000Z"), NOW)).toBe(false);
  });

  it("is stale just after 24 hours without an update", () => {
    expect(isStale(moving("2026-10-20T07:59:00.000Z"), NOW)).toBe(true);
  });

  it("is never stale when planned or delivered", () => {
    const old = [rawEvent("2026-10-01T08:00:00.000Z")];
    expect(isStale(shipment([road(null, null, null)], { rawEvents: old }), NOW)).toBe(false);
    const delivered = road("2026-10-01T08:00:00Z", "2026-10-01T09:00:00Z", "2026-10-01T12:00:00Z");
    expect(isStale(shipment([delivered], { rawEvents: old }), NOW)).toBe(false);
  });

  it("is not stale when the operator hasn't reported yet", () => {
    expect(isStale(shipment([road("2026-10-01T08:00:00Z", null, null)]), NOW)).toBe(false);
  });
});

describe("getEtaStatus", () => {
  const promised = "2026-10-25T00:00:00.000Z";
  const withOperatorEta = (date: string) => shipment([], { operatorEta: { date, source: "confirmed" }, plannedEta: promised });
  const prediction = (latest: string, confidence: number): EtaPrediction => ({
    earliest: latest,
    latest,
    confidence,
    reason: "test",
    source: "ai_predicted",
  });

  it.each([
    ["2026-10-24T00:00:00.000Z", "on_time"],
    ["2026-10-25T00:00:00.000Z", "on_time"],
    ["2026-10-25T00:01:00.000Z", "at_risk"],
    ["2026-10-26T00:00:00.000Z", "at_risk"],
    ["2026-10-26T00:01:00.000Z", "late"],
  ])("operator ETA %s is %s", (eta, status) => {
    expect(getEtaStatus(withOperatorEta(eta))).toEqual({ status, source: "confirmed" });
  });

  it("uses the operator ETA when the prediction is below 0.6 confidence", () => {
    const s = withOperatorEta(promised);
    expect(getEtaStatus(s, prediction("2026-10-28T00:00:00.000Z", 0.59))).toEqual({ status: "on_time", source: "confirmed" });
  });

  it("uses the prediction from 0.6 confidence, and says it's AI", () => {
    const s = withOperatorEta(promised);
    expect(getEtaStatus(s, prediction("2026-10-28T00:00:00.000Z", 0.6))).toEqual({ status: "late", source: "ai_predicted" });
  });

  it("keeps the operator's own source when there is no prediction", () => {
    const s = shipment([], { operatorEta: { date: promised, source: "estimated" }, plannedEta: promised });
    expect(getEtaStatus(s)).toEqual({ status: "on_time", source: "estimated" });
  });
});

describe("isOverdue", () => {
  const exception = (respondBy: string): ShipmentException => ({
    id: "exc-1",
    shipmentId: "SHP-TEST",
    type: "stale",
    detectedAt: "2026-10-21T06:00:00.000Z",
    severity: "warning",
    respondBy,
    impact: "",
    priorityScore: 0,
    priorityReason: "",
    suggestedAction: "contact_operator",
  });

  it("is not overdue exactly at the deadline", () => {
    expect(isOverdue(exception("2026-10-21T08:00:00.000Z"), NOW)).toBe(false);
  });

  it("is overdue after the deadline", () => {
    expect(isOverdue(exception("2026-10-21T07:59:00.000Z"), NOW)).toBe(true);
  });
});
