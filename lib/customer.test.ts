import { describe, expect, it } from "vitest";
import { getShipments } from "@/data/shipments";
import { customers, users } from "@/data/seed";
import { rankExceptions } from "@/lib/ai/triage";
import { visibleShipments } from "@/lib/access";
import { countByEta, customerAlerts, customerShipments, escalationAlerts } from "@/lib/customer";
import { daysAgo, getNow } from "@/lib/time";
import type { Shipment } from "@/lib/types";

const NOW = getNow();
const all = getShipments();
const summer = users.find((u) => u.id === "user-summer");
if (!summer) throw new Error("Seed persona user-summer is missing");
const ostrel = customerShipments(visibleShipments(summer, all), NOW);

/** A copy of a seed shipment delivered on the last leg at `at`. */
function deliveredAt(id: string, at: string): Shipment {
  const s = all.find((x) => x.id === id);
  if (!s) throw new Error(`Seed shipment ${id} is missing`);
  const legs = s.legs.map((leg) => ({ ...leg, milestones: leg.milestones.map((m) => ({ ...m, at: m.at ?? at })) }));
  return { ...s, legs };
}

describe("customerShipments", () => {
  it("lists late first, then at risk, then on time", () => {
    expect(ostrel.map((v) => [v.shipment.id, v.eta.status])).toEqual([
      ["SHP-1042", "late"],
      ["SHP-1049", "at_risk"],
      ["SHP-1045", "on_time"],
    ]);
  });

  it("puts delivered shipments last, newest delivery first", () => {
    const views = customerShipments([deliveredAt("SHP-1048", daysAgo(5)), deliveredAt("SHP-1044", daysAgo(1)), ...all.slice(0, 1)], NOW);
    expect(views.map((v) => v.shipment.id)).toEqual(["SHP-1042", "SHP-1044", "SHP-1048"]);
  });

  it("drops deliveries older than 30 days, keeps exactly 30", () => {
    const views = customerShipments([deliveredAt("SHP-1048", daysAgo(31)), deliveredAt("SHP-1044", daysAgo(30))], NOW);
    expect(views.map((v) => v.shipment.id)).toEqual(["SHP-1044"]);
  });

  it("hides a prediction that needs review, so the operator's ETA decides", () => {
    const stale = ostrel.find((v) => v.shipment.id === "SHP-1045");
    expect(stale?.prediction).toBeUndefined();
    expect(stale?.eta).toEqual({ status: "on_time", source: "estimated" });
  });

  it("carries the AI summary for each card", () => {
    expect(ostrel[0]?.summary.points[0]).toBe("At sea from Port of Valencia to Port of Hamburg");
  });
});

describe("countByEta", () => {
  it("counts active shipments by ETA status and deliveries apart", () => {
    expect(countByEta(ostrel)).toEqual({ on_time: 1, at_risk: 1, late: 1, delivered: 0 });
    const views = customerShipments([deliveredAt("SHP-1044", daysAgo(2)), ...all.slice(0, 1)], NOW);
    expect(countByEta(views)).toEqual({ on_time: 0, at_risk: 0, late: 1, delivered: 1 });
  });
});

describe("customerAlerts", () => {
  it("alerts on a High-confidence AI delay, labelled as a prediction", () => {
    expect(customerAlerts(ostrel)).toEqual([
      {
        id: "alert-SHP-1042-eta",
        shipmentId: "SHP-1042",
        severity: "warning",
        message: "SHP-1042 is likely to arrive about a day late: AI predicts Tue 27 Oct.",
        createdAt: expect.any(String),
        source: "ai_predicted",
        confidence: 0.85,
      },
    ]);
  });

  it("never alerts below 0.8: SHP-1046 (0.75) stays an ops matter", () => {
    const ids = customerAlerts(customerShipments(all, NOW)).map((a) => a.shipmentId);
    expect(ids).toEqual(["SHP-1042"]);
  });

  it("dates the alert when the late step was reported, never in the future", () => {
    const [alert] = customerAlerts(ostrel);
    expect(Date.parse(alert?.createdAt ?? "")).toBeLessThanOrEqual(NOW.getTime());
  });
});

describe("customerShipments: bad data", () => {
  it("keeps the same order whatever order the shipments come in, even with an unreadable ETA", () => {
    const bad = all.map((s) => (s.id === "SHP-1048" ? { ...s, operatorEta: { ...s.operatorEta, date: "x" } } : s));
    const ids = (list: Shipment[]) => customerShipments(list, NOW).map((v) => v.shipment.id);
    expect(ids([...bad].reverse())).toEqual(ids(bad));
  });
});

describe("escalationAlerts", () => {
  const exceptions = rankExceptions(all, customers, NOW);

  it("acknowledges an overdue customer-facing item that nobody approved, with no commitments", () => {
    expect(escalationAlerts(exceptions, new Set(), NOW)).toEqual([
      {
        id: "escalation-SHP-1043-customs_hold",
        shipmentId: "SHP-1043",
        severity: "critical",
        message: "We're aware of an issue with SHP-1043 and are working on it.",
        createdAt: exceptions[0]?.respondBy,
        source: "confirmed",
      },
    ]);
  });

  it("stays quiet once the draft is approved", () => {
    expect(escalationAlerts(exceptions, new Set(["SHP-1043-customs_hold"]), NOW)).toEqual([]);
  });

  it("never acknowledges internal items, even overdue: the stale SHP-1045 an hour later", () => {
    const later = new Date(NOW.getTime() + 60 * 60_000);
    const ids = escalationAlerts(rankExceptions(all, customers, later), new Set(), later).map((a) => a.shipmentId);
    expect(ids).not.toContain("SHP-1045");
    expect(ids).toContain("SHP-1043");
  });
});
