import { describe, expect, it } from "vitest";
import { places as p } from "@/data/locations";
import { documents, roadLeg, seaLeg } from "@/data/plan";
import { getMidDemoShipments } from "@/data/fixtures";
import { exceptionOutcome, messageReading, messagesNewestFirst, timelineGroups, type TimelineGroup } from "@/lib/detail";
import { sentAlertId } from "@/lib/inbox";
import { hoursAgo, hoursFromNow } from "@/lib/time";
import type { CustomerAlert, MilestoneType, RawEventRef, Shipment } from "@/lib/types";

const seed = getMidDemoShipments();

function shipment(id: string): Shipment {
  const found = seed.find((s) => s.id === id);
  if (!found) throw new Error(`Missing seed shipment ${id}`);
  return found;
}

/** Each group as a line, e.g. "leg 2: gate_in=done, loaded=current". */
function states(groups: TimelineGroup[]): string[] {
  return groups.map((g) => {
    const head = g.kind === "leg" ? `leg ${g.leg.sequence}` : `customs ${g.place.name}`;
    return `${head}: ${g.steps.map((s) => `${s.milestone.type}=${s.state}`).join(", ")}`;
  });
}

/** A road → sea (with customs) → road shipment, with the given steps reported `hours` ago. */
function withSteps(done: Partial<Record<`${number}:${MilestoneType}`, number>>): Shipment {
  const legs = [
    roadLeg(1, "op-corvala", p.zaragoza, p.valencia, [-50, -48, -40]),
    seaLeg(2, p.valencia, p.southampton, [-36, -30, -28, -12, -10], { submitted: -8, cleared: -6 }),
    roadLeg(3, "op-quickfern", p.southampton, p.thornquistLeeds, [8, 9, 20]),
  ];
  for (const leg of legs) {
    leg.milestones = leg.milestones.map((m) => {
      const hours = done[`${leg.sequence}:${m.type}`];
      return hours === undefined ? m : { ...m, at: hoursAgo(hours), source: "confirmed" };
    });
  }
  return {
    id: "SHP-TEST",
    customerId: "cust-thornquist",
    originSiteId: "site-zaragoza",
    international: true,
    requiresCustoms: true,
    legs,
    operatorEta: { date: hoursFromNow(20), source: "estimated" },
    plannedEta: hoursFromNow(20),
    documents: documents(["commercial_invoice"]),
    rawEvents: [],
  };
}

describe("timelineGroups", () => {
  it("puts customs in its own block after the sea leg, at the arrival port", () => {
    const groups = timelineGroups(shipment("SHP-1046"));
    expect(groups.map((g) => g.kind)).toEqual(["leg", "leg", "customs", "leg"]);
    const customs = groups[2];
    expect(customs?.kind === "customs" && customs.place.name).toBe("Port of Southampton");
  });

  it("has no customs block for a shipment that stays in the EU", () => {
    expect(timelineGroups(shipment("SHP-1042")).every((g) => g.kind === "leg")).toBe(true);
  });

  it("marks done steps, the next one as current, and the rest as upcoming", () => {
    expect(states(timelineGroups(shipment("SHP-1042")))).toEqual([
      "leg 1: picked_up=done, in_transit=done, delivered=done",
      "leg 2: gate_in=done, loaded=done, departed=done, arrived=current, discharged=upcoming",
      "leg 3: picked_up=upcoming, in_transit=upcoming, delivered=upcoming",
    ]);
  });

  it("makes the first step current before anything has happened", () => {
    const [first] = timelineGroups(shipment("SHP-1050"));
    expect(first?.steps[0]?.state).toBe("current");
  });

  it("has no current step once delivered", () => {
    const steps = timelineGroups(shipment("SHP-1047")).flatMap((g) => g.steps);
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });

  it("during a customs hold, shows the unreported declaration as passed and clearance as current", () => {
    const customs = timelineGroups(shipment("SHP-1043")).find((g) => g.kind === "customs");
    expect(customs?.steps.map((s) => `${s.milestone.type}=${s.state}`)).toEqual([
      "customs_submitted=not_reported",
      "customs_hold=done",
      "customs_cleared=current",
    ]);
  });

  it("keeps clearance current when the hold was reported after the planned clearance time", () => {
    const s = withSteps({ "1:delivered": 40, "2:discharged": 10 });
    const sea = s.legs[1];
    if (!sea) throw new Error("Missing sea leg");
    // Reported 2 hours ago, after clearance was planned (6 hours ago): sorted after it.
    sea.milestones.push({ type: "customs_hold", at: hoursAgo(2), plannedAt: hoursAgo(2), source: "confirmed" });
    const customs = timelineGroups(s).find((g) => g.kind === "customs");
    expect(customs?.steps.map((step) => `${step.milestone.type}=${step.state}`)).toEqual([
      "customs_submitted=not_reported",
      "customs_cleared=current",
      "customs_hold=done",
    ]);
  });

  it("shows skipped reports as not reported, never as done or still to come", () => {
    // The truck reported pickup and delivery to the port, but never "in transit".
    const groups = timelineGroups(withSteps({ "1:picked_up": 50, "1:delivered": 40 }));
    expect(states(groups)[0]).toBe("leg 1: picked_up=done, in_transit=not_reported, delivered=done");
    expect(groups[1]?.steps[0]?.state).toBe("current");
  });

  it("treats a cleared hold like any other passed step", () => {
    const s = withSteps({ "1:delivered": 40, "2:discharged": 10, "2:customs_cleared": 1 });
    const customs = timelineGroups(s).find((g) => g.kind === "customs");
    expect(customs?.steps.map((step) => step.state)).toEqual(["not_reported", "done"]);
  });
});

function event(overrides: Partial<RawEventRef>): RawEventRef {
  return {
    operatorId: "op-saltwren",
    receivedAt: hoursAgo(1),
    channel: "edi",
    original: "DEP ESVLC",
    normalizedTo: "departed",
    confidence: 1,
    ...overrides,
  };
}

describe("messageReading", () => {
  it("applies a known status code", () => {
    expect(messageReading(event({}))).toEqual({
      readAs: "Departed",
      applied: true,
      reason: "A known status code. Applied to the timeline.",
    });
  });

  it("applies a confident reading of free text, saying it was matched from the text", () => {
    const reading = messageReading(event({ channel: "email", normalizedTo: "customs_hold", confidence: 0.82 }));
    expect(reading.applied).toBe(true);
    expect(reading.readAs).toBe("Held by customs");
    expect(reading.reason).toContain("Matched from the message text");
  });

  it("keeps an uncertain reading for review without applying it, exactly as applyEvents does", () => {
    expect(messageReading(event({ confidence: 0.59 })).applied).toBe(false);
    expect(messageReading(event({ confidence: 0.6 })).applied).toBe(true);
    expect(messageReading(event({ confidence: 0.45 })).reason).toContain("Too uncertain");
  });

  it("says when nothing was recognised", () => {
    const reading = messageReading(event({ normalizedTo: null, confidence: 0 }));
    expect(reading).toMatchObject({ readAs: null, applied: false });
    expect(reading.reason).toContain("No shipment step recognised");
  });

  it("matches what applyEvents did to the seed timelines", () => {
    // SHP-1048's vague email (0.45) must not have completed "arrived".
    const s = shipment("SHP-1048");
    const email = s.rawEvents.find((e) => e.channel === "email");
    expect(email && messageReading(email).applied).toBe(false);
    expect(s.legs[1]?.milestones.find((m) => m.type === "arrived")?.at).toBeNull();
  });
});

describe("messagesNewestFirst", () => {
  it("sorts newest first without changing the shipment", () => {
    const s = shipment("SHP-1043");
    const before = s.rawEvents.map((e) => e.receivedAt);
    const sorted = messagesNewestFirst(s).map((e) => Date.parse(e.receivedAt));
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
    expect(messagesNewestFirst(s)[0]?.channel).toBe("email");
    expect(s.rawEvents.map((e) => e.receivedAt)).toEqual(before);
  });
});

describe("exceptionOutcome", () => {
  const none = { handledIds: [], settledIds: [], sentAlerts: [] };
  const sent: CustomerAlert = {
    id: sentAlertId("exc-1"),
    shipmentId: "SHP-1043",
    severity: "critical",
    message: "Hi",
    createdAt: hoursAgo(0),
    source: "confirmed",
  };

  it("is open until ops does something", () => {
    expect(exceptionOutcome("exc-1", none)).toBe("open");
  });

  it("tells a snooze, a resolve and a sent message apart, the most telling first", () => {
    expect(exceptionOutcome("exc-1", { ...none, handledIds: ["exc-1"] })).toBe("followed_up");
    expect(exceptionOutcome("exc-1", { ...none, handledIds: ["exc-1"], settledIds: ["exc-1"] })).toBe("resolved");
    expect(
      exceptionOutcome("exc-1", { handledIds: ["exc-1"], settledIds: ["exc-1"], sentAlerts: [sent] }),
    ).toBe("customer_notified");
  });

  it("ignores actions on other exceptions", () => {
    expect(exceptionOutcome("exc-2", { handledIds: ["exc-1"], settledIds: ["exc-1"], sentAlerts: [sent] })).toBe("open");
  });
});
