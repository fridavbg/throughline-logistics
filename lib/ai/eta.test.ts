import { describe, expect, it } from "vitest";
import { predictEta } from "@/lib/ai/eta";
import { getEtaStatus } from "@/lib/derived";
import { HOUR_MS } from "@/lib/time";
import type { Leg, Mode, MilestoneType, RawEventRef, Shipment } from "@/lib/types";

const NOW = new Date("2026-10-21T08:00:00.000Z");
const valencia = { name: "Port of Valencia", country: "ES", kind: "port" } as const;
const hamburg = { name: "Port of Hamburg", country: "DE", kind: "port" } as const;

/** The time `hours` from NOW, as an ISO string. Negative is in the past. */
const t = (hours: number) => new Date(NOW.getTime() + hours * HOUR_MS).toISOString();

/** A step: its type, when it was planned and when it happened (`null`: not yet), in hours from NOW. */
type Step = [MilestoneType, number, number | null];

function leg(sequence: number, mode: Mode, steps: Step[]): Leg {
  return {
    sequence,
    mode,
    operatorId: mode === "sea" ? "op-saltwren" : "op-corvala",
    from: valencia,
    to: hamburg,
    milestones: steps.map(([type, planned, happened]) => ({
      type,
      plannedAt: t(planned),
      at: happened === null ? null : t(happened),
      source: "confirmed",
    })),
  };
}

/** A sea leg that departed `late` hours after its plan, an hour ago. */
const departedLate = (late: number) =>
  leg(1, "sea", [["loaded", -1 - late - 2, -3], ["departed", -1 - late, -1], ["arrived", 100, null]]);

const roadAfter = leg(2, "road", [["picked_up", 104, null], ["delivered", 110, null]]);

function rawEvent(hoursAgo: number): RawEventRef {
  return { operatorId: "op-saltwren", receivedAt: t(-hoursAgo), channel: "edi", original: "x", normalizedTo: null, confidence: 1 };
}

function shipment(legs: Leg[], overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "SHP-TEST",
    customerId: "cust-ostrel-de",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: false,
    legs,
    operatorEta: { date: t(110), source: "estimated" },
    plannedEta: t(110),
    documents: [],
    rawEvents: [rawEvent(1)],
    ...overrides,
  };
}

describe("predictEta: when there is nothing to add", () => {
  it("has no prediction before the shipment has left", () => {
    expect(predictEta(shipment([leg(1, "road", [["picked_up", 5, null]])], { rawEvents: [] }), NOW)).toBeUndefined();
  });

  it("has no prediction once delivered", () => {
    const s = shipment([leg(1, "road", [["picked_up", -10, -10], ["delivered", -2, -2]])]);
    expect(predictEta(s, NOW)).toBeUndefined();
  });

  it("has no prediction during a customs hold: when it's released is unknown", () => {
    const sea = leg(1, "sea", [["departed", -50, -40], ["arrived", -5, -5], ["customs_hold", -4, -4]]);
    expect(predictEta(shipment([sea], { requiresCustoms: true }), NOW)).toBeUndefined();
  });

  it("has no prediction when the latest step was on time", () => {
    expect(predictEta(shipment([departedLate(0), roadAfter]), NOW)).toBeUndefined();
  });

  it("treats less than an hour late as on time", () => {
    expect(predictEta(shipment([departedLate(0.9), roadAfter]), NOW)).toBeUndefined();
  });

  it("goes by the latest step, so a delay made up later no longer counts", () => {
    const caughtUp = leg(1, "sea", [["loaded", -30, -4], ["departed", -1, -1], ["arrived", 100, null]]);
    expect(predictEta(shipment([caughtUp, roadAfter]), NOW)).toBeUndefined();
  });

  it("has no prediction when the operator's ETA already allows for the delay", () => {
    const s = shipment([departedLate(26), roadAfter], { operatorEta: { date: t(136), source: "estimated" } });
    expect(predictEta(s, NOW)).toBeUndefined();
  });
});

describe("predictEta: a known delay", () => {
  it("moves the promised arrival by the delay, allowing a quarter of it to be made up", () => {
    expect(predictEta(shipment([departedLate(26), roadAfter]), NOW)).toEqual({
      earliest: t(110 + 19.5),
      latest: t(110 + 26),
      confidence: 0.85,
      reason: "Vessel departed 26h late from Port of Valencia",
      source: "ai_predicted",
    });
  });

  it("is less confident while customs is still ahead", () => {
    const s = shipment([departedLate(26), roadAfter], { requiresCustoms: true });
    expect(predictEta(s, NOW)?.confidence).toBe(0.75);
  });

  it("is less confident when the operator has gone quiet", () => {
    const s = shipment([departedLate(26), roadAfter], { rawEvents: [rawEvent(30)] });
    expect(predictEta(s, NOW)?.confidence).toBe(0.55);
  });

  it("rounds the hours in the reason", () => {
    expect(predictEta(shipment([departedLate(23.8), roadAfter]), NOW)?.reason).toBe(
      "Vessel departed 24h late from Port of Valencia",
    );
  });

  it("makes the shipment late by the AI's prediction, not the operator's ETA", () => {
    const s = shipment([departedLate(26), roadAfter]);
    expect(getEtaStatus(s, predictEta(s, NOW))).toEqual({ status: "late", source: "ai_predicted" });
  });
});

describe("predictEta: a stale shipment with no known delay", () => {
  const s = shipment([departedLate(0), roadAfter], { rawEvents: [rawEvent(26)] });

  it("could arrive as late as the silence has lasted, and needs review", () => {
    expect(predictEta(s, NOW)).toEqual({
      earliest: t(110),
      latest: t(110 + 26),
      confidence: 0.5,
      reason: "No operator update for 26h",
      source: "ai_predicted",
    });
  });

  it("doesn't decide lateness: below 0.6 the operator's ETA still counts", () => {
    expect(getEtaStatus(s, predictEta(s, NOW))).toEqual({ status: "on_time", source: "estimated" });
  });
});

describe("predictEta: safety", () => {
  it("never changes the shipment or its operator ETA", () => {
    const s = shipment([departedLate(26), roadAfter]);
    const before = structuredClone(s);
    predictEta(s, NOW);
    expect(s).toEqual(before);
  });

  it("gives the same prediction for the same shipment and time", () => {
    const s = shipment([departedLate(26), roadAfter]);
    expect(predictEta(s, NOW)).toEqual(predictEta(s, NOW));
  });
});
