// Each seed shipment must still show the scenario it exists for (docs/DATA_MODEL.md §7).
// The rules themselves are tested in lib/derived.test.ts and lib/ai/eta.test.ts; here they
// run on the seed.
import { describe, expect, it } from "vitest";
import { getBookings } from "@/data/bookings";
import { getOperatorEvents, getShipments } from "@/data/shipments";
import { predictEta } from "@/lib/ai/eta";
import { getEtaStatus, getShipmentStatus, isStale } from "@/lib/derived";
import { DEMO_NOW } from "@/lib/time";
import type { MilestoneType, Shipment } from "@/lib/types";

const shipments = getShipments();
const byId = new Map(shipments.map((s) => [s.id, s]));
const get = (id: string): Shipment => {
  const s = byId.get(id);
  if (!s) throw new Error(`Missing seed shipment ${id}`);
  return s;
};
const done = (s: Shipment, type: MilestoneType) =>
  s.legs.flatMap((l) => l.milestones).find((m) => m.type === type && m.at !== null);
const minutesSince = (iso: string) => (DEMO_NOW.getTime() - Date.parse(iso)) / 60_000;
const newestUpdate = (s: Shipment) => s.rawEvents.map((e) => e.receivedAt).sort().at(-1);

describe("seed data", () => {
  it("has SHP-1042 to SHP-1050", () => {
    expect([...byId.keys()]).toEqual(Array.from({ length: 9 }, (_, i) => `SHP-${1042 + i}`));
  });

  it("returns fresh copies, so changing a shipment can't change the seed", () => {
    const first = getShipments();
    const milestone = first[0]?.legs[0]?.milestones[0];
    const lastLeg = first[8]?.legs[0];
    if (!milestone || !lastLeg) throw new Error("The seed has fewer shipments than this test expects");
    const original = milestone.at;
    milestone.at = "changed";
    lastLeg.milestones.push({ ...milestone });

    const again = getShipments();
    expect(again[0]?.legs[0]?.milestones[0]?.at).toBe(original);
    expect(again[8]?.legs[0]?.milestones).toHaveLength(3);
  });

  it("only has operator events for shipments that exist", () => {
    const ids = new Set(getBookings().map((b) => b.id));
    const orphans = getOperatorEvents().filter((e) => !ids.has(e.shipmentId));
    expect(orphans).toEqual([]);
  });

  it("puts every operator update on a shipment as a raw event", () => {
    expect(shipments.reduce((n, s) => n + s.rawEvents.length, 0)).toBe(getOperatorEvents().length);
  });

  it("keeps the operator's original message on every completed step", () => {
    for (const s of shipments) {
      for (const m of s.legs.flatMap((l) => l.milestones)) {
        if (m.at !== null) expect(m.rawStatus, `${s.id} ${m.type}`).toBeTruthy();
      }
    }
  });

  it("only uses operators that run the leg's mode", () => {
    for (const s of shipments) {
      for (const l of s.legs) expect(l.mode === "sea").toBe(l.operatorId === "op-saltwren");
    }
  });

  it("has legs that connect: each leg starts where the previous one ended", () => {
    for (const s of shipments) {
      s.legs.slice(1).forEach((l, i) => expect(l.from, `${s.id} leg ${l.sequence}`).toEqual(s.legs[i]?.to));
    }
  });

  it("plans every step after the one before it, across the whole shipment", () => {
    for (const s of shipments) {
      const planned = s.legs.flatMap((l) => l.milestones.filter((m) => m.type !== "customs_hold").map((m) => m.plannedAt));
      expect(planned, s.id).toEqual([...planned].sort());
    }
  });

  it("promises arrival at the end of the last leg", () => {
    for (const s of shipments) {
      const lastDelivery = s.legs.at(-1)?.milestones.find((m) => m.type === "delivered")?.plannedAt;
      expect(s.plannedEta, s.id).toBe(lastDelivery);
    }
  });

  it("mixes origin sites, so the Terrassa persona sees a subset", () => {
    const fromTerrassa = shipments.filter((s) => s.originSiteId === "site-terrassa").length;
    expect(new Set(shipments.map((s) => s.originSiteId)).size).toBe(3);
    expect(fromTerrassa).toBeGreaterThan(0);
    expect(fromTerrassa).toBeLessThan(shipments.length);
  });
});

describe("seed scenarios", () => {
  it("SHP-1042 left Valencia 26 hours late, an hour ago, with the operator's ETA unchanged", () => {
    const s = get("SHP-1042");
    const departed = done(s, "departed")!;
    expect((Date.parse(departed.at!) - Date.parse(departed.plannedAt)) / 3_600_000).toBe(26);
    expect(minutesSince(departed.at!)).toBe(60);
    expect(s.operatorEta.date).toBe(s.plannedEta);
  });

  it("gives the inbox one overdue item and one due within 10 minutes (detected at the revealing event)", () => {
    // Response targets: 30 min for the critical customs hold, 2 h for warnings (PRD §5 F2).
    const minutesLeft = {
      "SHP-1043 customs hold": 30 - minutesSince(newestUpdate(get("SHP-1043"))!),
      "SHP-1045 stale": 120 - (minutesSince(newestUpdate(get("SHP-1045"))!) - 24 * 60),
      "SHP-1042 delay": 120 - minutesSince(newestUpdate(get("SHP-1042"))!),
      "SHP-1046 delay": 120 - minutesSince(newestUpdate(get("SHP-1046"))!),
      "SHP-1048 review": 120 - minutesSince(newestUpdate(get("SHP-1048"))!),
      "SHP-1049 at risk": 120 - minutesSince(newestUpdate(get("SHP-1049"))!),
    };
    const left = Object.values(minutesLeft);
    expect(left.filter((m) => m < 0)).toHaveLength(1);
    expect(minutesLeft["SHP-1043 customs hold"]).toBeLessThan(0);
    expect(left.filter((m) => m >= 0 && m < 10)).toEqual([8]);
    expect(left.filter((m) => m >= 10).every((m) => m >= 30)).toBe(true);
  });

  it("SHP-1043 is held by customs on the sea leg 40 minutes ago, packing list missing", () => {
    const s = get("SHP-1043");
    const hold = s.legs[1]?.milestones.find((m) => m.type === "customs_hold");
    expect(hold?.at).toBeTruthy();
    expect(minutesSince(hold!.at!)).toBe(40); // past the 30-minute response target
    expect(s.documents.find((d) => d.type === "packing_list")?.status).toBe("missing");
  });

  it("SHP-1044 is a domestic road shipment, not delivered yet", () => {
    const s = get("SHP-1044");
    expect(s.international).toBe(false);
    expect(done(s, "delivered")).toBeUndefined();
  });

  it("SHP-1045 last heard from 25h52m ago: stale, and due for review in 8 minutes", () => {
    expect(minutesSince(newestUpdate(get("SHP-1045"))!)).toBe(25 * 60 + 52);
  });

  it("SHP-1046 left Barcelona about a day late, while the operator's ETA still says on time", () => {
    const s = get("SHP-1046");
    const departed = done(s, "departed")!;
    const lateHours = (Date.parse(departed.at!) - Date.parse(departed.plannedAt)) / 3_600_000;
    expect(lateHours).toBeGreaterThan(23);
    expect(s.operatorEta.date).toBe(s.plannedEta);
  });

  it("SHP-1047 is delivered on its last leg", () => {
    const s = get("SHP-1047");
    expect(s.legs.at(-1)?.milestones.find((m) => m.type === "delivered")?.at).toBeTruthy();
  });

  it("SHP-1048 has a 0.45 email that didn't change the timeline", () => {
    const s = get("SHP-1048");
    expect(s.rawEvents.find((e) => e.channel === "email")?.confidence).toBe(0.45);
    expect(done(s, "arrived")).toBeUndefined();
  });

  it("SHP-1049 is on the road, with an operator ETA 14 hours past the promise", () => {
    const s = get("SHP-1049");
    expect((Date.parse(s.operatorEta.date) - Date.parse(s.plannedEta)) / 3_600_000).toBe(14);
  });

  it("SHP-1050 hasn't been picked up and has no operator updates", () => {
    const s = get("SHP-1050");
    expect(s.rawEvents).toEqual([]);
    expect(s.legs.flatMap((l) => l.milestones).every((m) => m.at === null)).toBe(true);
  });

  it("derives the status each scenario describes", () => {
    const statuses = Object.fromEntries(shipments.map((s) => [s.id, getShipmentStatus(s)]));
    expect(statuses).toEqual({
      "SHP-1042": "in_transit",
      "SHP-1043": "customs_hold",
      "SHP-1044": "in_transit",
      "SHP-1045": "in_transit",
      "SHP-1046": "in_transit",
      "SHP-1047": "delivered",
      "SHP-1048": "in_transit",
      "SHP-1049": "in_transit",
      "SHP-1050": "planned",
    });
  });

  it("has SHP-1045 as the only stale shipment at the demo time", () => {
    expect(shipments.filter((s) => isStale(s, DEMO_NOW)).map((s) => s.id)).toEqual(["SHP-1045"]);
  });

  it("has SHP-1049 as the only shipment at risk by its operator ETA", () => {
    const delayed = shipments
      .filter((s) => ["at_risk", "late"].includes(getEtaStatus(s).status))
      .map((s) => s.id);
    expect(delayed).toEqual(["SHP-1049"]);
    expect(getEtaStatus(get("SHP-1049"))).toEqual({ status: "at_risk", source: "estimated" });
  });

  it("SHP-1043: no on-time answer while customs holds it (demo step 2)", () => {
    expect(getEtaStatus(get("SHP-1043")).status).toBe("unknown");
  });

  it("predicts an ETA only for the delayed and the stale shipments", () => {
    const predicted = shipments.filter((s) => predictEta(s, DEMO_NOW) !== undefined).map((s) => s.id);
    expect(predicted).toEqual(["SHP-1042", "SHP-1045", "SHP-1046"]);
  });

  it("SHP-1042: High confidence it's late, so the customer can be alerted (demo step 6)", () => {
    const s = get("SHP-1042");
    const prediction = predictEta(s, DEMO_NOW);
    expect(prediction?.confidence).toBe(0.85);
    expect(prediction?.reason).toBe("Vessel departed 26h late from Port of Valencia");
    expect(getEtaStatus(s, prediction)).toEqual({ status: "late", source: "ai_predicted" });
  });

  it("SHP-1046: at risk by the AI before the operator's ETA moves, Medium because customs is ahead", () => {
    const s = get("SHP-1046");
    const prediction = predictEta(s, DEMO_NOW);
    expect(prediction?.confidence).toBe(0.75);
    expect(getEtaStatus(s)).toEqual({ status: "on_time", source: "estimated" });
    expect(getEtaStatus(s, prediction)).toEqual({ status: "at_risk", source: "ai_predicted" });
  });

  it("SHP-1045: the stale shipment's prediction needs review, so it doesn't decide lateness", () => {
    const s = get("SHP-1045");
    const prediction = predictEta(s, DEMO_NOW);
    expect(prediction?.confidence).toBe(0.5);
    expect(getEtaStatus(s, prediction)).toEqual({ status: "on_time", source: "estimated" });
  });

  it("customs steps only appear on shipments leaving the EU", () => {
    for (const s of shipments) {
      const hasCustoms = s.legs.some((l) => l.milestones.some((m) => m.type.startsWith("customs_")));
      expect(hasCustoms, s.id).toBe(s.requiresCustoms);
    }
  });
});
