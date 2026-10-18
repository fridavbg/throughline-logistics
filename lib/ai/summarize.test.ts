import { describe, expect, it } from "vitest";
import { FACTS_CONFIDENCE, summarizeShipment } from "@/lib/ai/summarize";
import { formatDay, HOUR_MS } from "@/lib/time";
import type { Leg, Mode, MilestoneType, RawEventRef, Shipment } from "@/lib/types";

const NOW = new Date("2026-10-21T08:00:00.000Z"); // Wed 21 Oct, 10:00 in Spain
const terrassa = { name: "Terrassa plant", country: "ES", kind: "site" } as const;
const valencia = { name: "Port of Valencia", country: "ES", kind: "port" } as const;
const southampton = { name: "Port of Southampton", country: "GB", kind: "port" } as const;
const leeds = { name: "Leeds DC", country: "GB", kind: "customer" } as const;

/** The time `hours` from NOW, as an ISO string. Negative is in the past. */
const t = (hours: number) => new Date(NOW.getTime() + hours * HOUR_MS).toISOString();

/** A step: its type, when it was planned and when it happened (`null`: not yet), in hours from NOW. */
type Step = [MilestoneType, number, number | null];

function leg(sequence: number, mode: Mode, from: Leg["from"], to: Leg["to"], steps: Step[]): Leg {
  return {
    sequence,
    mode,
    operatorId: mode === "sea" ? "op-saltwren" : "op-corvala",
    from,
    to,
    milestones: steps.map(([type, planned, happened]) => ({
      type,
      plannedAt: t(planned),
      at: happened === null ? null : t(happened),
      source: "confirmed",
    })),
  };
}

function rawEvent(hoursAgo: number): RawEventRef {
  return { operatorId: "op-saltwren", receivedAt: t(-hoursAgo), channel: "edi", original: "x", normalizedTo: null, confidence: 1 };
}

/** Road to Valencia, sea to Southampton, road to Leeds. `seaSteps` decide how far it got. */
function shipment(seaSteps: Step[], overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "SHP-TEST",
    customerId: "cust-test",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: false,
    legs: [
      leg(1, "road", terrassa, valencia, [["picked_up", -60, -60], ["delivered", -50, -50]]),
      leg(2, "sea", valencia, southampton, seaSteps),
      leg(3, "road", southampton, leeds, [["picked_up", 80, null], ["delivered", 90, null]]),
    ],
    operatorEta: { date: t(90), source: "estimated" },
    plannedEta: t(90),
    documents: [],
    rawEvents: [rawEvent(2)],
    ...overrides,
  };
}

/** At sea, departed on time two hours ago. */
const atSea: Step[] = [["loaded", -6, -6], ["departed", -2, -2], ["arrived", 60, null], ["discharged", 62, null]];
const ETA_DAY = formatDay(t(90));

describe("summarizeShipment: points per status", () => {
  it("planned: where it will be picked up and when it's expected", () => {
    const s = shipment([["departed", 10, null]], {
      legs: [leg(1, "road", terrassa, leeds, [["picked_up", 5, null], ["delivered", 90, null]])],
      rawEvents: [],
    });
    expect(summarizeShipment(s, NOW).points).toEqual([
      "Booked for pickup at Terrassa plant",
      `Expected ${ETA_DAY} (operator estimate), on time`,
    ]);
  });

  it("in transit: the current leg, the ETA and the next step", () => {
    expect(summarizeShipment(shipment(atSea), NOW).points).toEqual([
      "At sea from Port of Valencia to Port of Southampton",
      `Expected ${ETA_DAY} (operator estimate), on time`,
      "Next: arrival at Port of Southampton",
    ]);
  });

  it("at port: the port of the latest step", () => {
    const s = shipment([["departed", -40, -40], ["arrived", -3, -3], ["discharged", 2, null]]);
    expect(summarizeShipment(s, NOW).points).toEqual([
      "At Port of Southampton",
      `Expected ${ETA_DAY} (operator estimate), on time`,
      "Next: unloading at Port of Southampton",
    ]);
  });

  it("customs hold: no arrival date, since the release time is unknown", () => {
    const s = shipment([["arrived", -5, -5], ["customs_hold", -4, -4], ["customs_cleared", 10, null]], {
      requiresCustoms: true,
    });
    const { points } = summarizeShipment(s, NOW);
    expect(points).toEqual(["Held by customs at Port of Southampton", "Arrival date depends on when it's released"]);
    expect(points.join(" ")).not.toContain(ETA_DAY);
  });

  it("delivered: where and when, from the delivery step", () => {
    const s = shipment([["departed", -40, -40], ["arrived", -20, -20]], {
      legs: [leg(1, "road", terrassa, leeds, [["picked_up", -30, -30], ["delivered", -3, -3]])],
    });
    expect(summarizeShipment(s, NOW).points).toEqual([`Delivered to Leeds DC on ${formatDay(t(-3))}`]);
  });
});

/** The point about the arrival: the second one for a moving shipment. */
const arrivalPoint = (s: Shipment) => summarizeShipment(s, NOW).points[1];

describe("summarizeShipment: one wording per ETA status", () => {
  it("on time when the operator's ETA keeps the promise", () => {
    expect(arrivalPoint(shipment(atSea))).toBe(`Expected ${ETA_DAY} (operator estimate), on time`);
  });

  it("up to a day late when the operator's ETA is within 24h of the promise", () => {
    const s = shipment(atSea, { operatorEta: { date: t(100), source: "estimated" } });
    expect(arrivalPoint(s)).toBe(`Expected ${formatDay(t(100))} (operator estimate), up to a day late`);
  });

  it("more than a day late when the AI predicts beyond 24h, with the window's days", () => {
    const late: Step[] = [["loaded", -60, -6], ["departed", -50, -2], ["arrived", 60, null]];
    expect(arrivalPoint(shipment(late))).toBe(
      `AI predicts arrival ${formatDay(t(126))} – ${formatDay(t(138))}, more than a day late`,
    );
  });

  it("names one day when the AI's window starts and ends on the same day", () => {
    const late: Step[] = [["loaded", -40, -6], ["departed", -30, -2], ["arrived", 60, null]];
    expect(formatDay(t(111))).toBe(formatDay(t(118)));
    expect(arrivalPoint(shipment(late))).toBe(`AI predicts arrival ${formatDay(t(118))}, more than a day late`);
  });
});

describe("summarizeShipment: never states more than the data knows", () => {
  it("says 'Arriving' only for a confirmed ETA", () => {
    const s = shipment(atSea, { operatorEta: { date: t(90), source: "confirmed" } });
    expect(arrivalPoint(s)).toBe(`Arriving ${ETA_DAY}, on time`);
    expect(summarizeShipment(shipment(atSea), NOW).points.join(" ")).not.toContain("Arriving");
  });

  it("words an AI prediction as one, with its reason as the why", () => {
    const late: Step[] = [["loaded", -40, -6], ["departed", -30, -2], ["arrived", 60, null]];
    const summary = summarizeShipment(shipment(late), NOW);
    expect(summary.points[1]).toMatch(/^AI predicts arrival/);
    expect(summary.confidence).toBe(0.85);
    expect(summary.reason).toBe("AI prediction: Vessel departed 28h late from Port of Valencia; last update 2h ago");
  });

  it("leaves out a prediction that needs review, and says the operator has gone quiet", () => {
    const summary = summarizeShipment(shipment(atSea, { rawEvents: [rawEvent(31)] }), NOW);
    // "Needs review" means no firm answer, so it doesn't say "on time".
    expect(summary.points).toEqual([
      "At sea from Port of Valencia to Port of Southampton",
      `Expected ${ETA_DAY} (operator estimate)`,
      "No operator update for 31h",
      "Next: arrival at Port of Southampton",
    ]);
    expect(summary.confidence).toBe(0.5);
    expect(summary.reason).toBe("Operator estimate; last update 31h ago");
  });

  it("still says how late when a known delay is behind a quiet operator", () => {
    const late: Step[] = [["loaded", -70, -40], ["departed", -60, -31], ["arrived", 60, null]];
    const summary = summarizeShipment(shipment(late, { rawEvents: [rawEvent(31)] }), NOW);
    expect(summary.points[1]).toMatch(/more than a day late$/);
    expect(summary.points[2]).toBe("No operator update for 31h");
    expect(summary.confidence).toBe(0.6);
  });

  it("is confident when it only repeats operator data", () => {
    const summary = summarizeShipment(shipment(atSea), NOW);
    expect(summary.confidence).toBe(FACTS_CONFIDENCE);
    expect(summary.reason).toBe("Operator estimate; last update 2h ago");
  });

  it("says 'Reported delivered' when the delivery is only an estimate", () => {
    const road = leg(1, "road", terrassa, leeds, [["picked_up", -30, -30], ["delivered", -3, -3]]);
    const estimated = { ...road, milestones: road.milestones.map((m) => ({ ...m, source: "estimated" as const })) };
    expect(summarizeShipment(shipment([], { legs: [estimated] }), NOW).points[0]).toMatch(/^Reported delivered to Leeds DC/);
  });
});

describe("summarizeShipment: what happens next", () => {
  it("skips steps the operator never reported, and goes on from the furthest one", () => {
    const skipped: Step[] = [["loaded", -6, null], ["departed", -2, -2], ["arrived", 60, null]];
    expect(summarizeShipment(shipment(skipped), NOW).points.at(-1)).toBe("Next: arrival at Port of Southampton");
  });

  it("calls a drop-off at the port on an earlier leg a drop-off, not a delivery", () => {
    const s = shipment([["gate_in", -1, null]], {
      legs: [
        leg(1, "road", terrassa, valencia, [["picked_up", -3, -3], ["delivered", 2, null]]),
        leg(2, "sea", valencia, southampton, [["departed", 20, null]]),
      ],
    });
    expect(summarizeShipment(s, NOW).points.at(-1)).toBe("Next: drop-off at Port of Valencia");
  });
});
