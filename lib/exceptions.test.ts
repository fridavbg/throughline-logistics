import { describe, expect, it } from "vitest";
import { getShipments } from "@/data/shipments";
import { detectExceptions, RESPONSE_MINUTES, severityOf } from "@/lib/exceptions";
import { getNow, hoursAgo, minutesAgo } from "@/lib/time";
import type { RawEventRef, Shipment } from "@/lib/types";

const NOW = getNow();
const all = getShipments();

function seed(id: string): Shipment {
  const s = all.find((x) => x.id === id);
  if (!s) throw new Error(`Seed shipment ${id} is missing`);
  return s;
}

const found = (s: Shipment) => detectExceptions(s, NOW).map((e) => [e.type, e.suggestedAction]);

describe("detectExceptions: the seed at the demo time", () => {
  it("finds exactly the demo's problems, one row per problem", () => {
    const byShipment = Object.fromEntries(all.map((s) => [s.id, found(s)]));
    expect(byShipment).toEqual({
      "SHP-1042": [["delay", "contact_operator"]],
      "SHP-1043": [["customs_hold", "request_document"]],
      "SHP-1044": [],
      "SHP-1045": [["stale", "contact_operator"]],
      "SHP-1046": [["delay", "notify_customer"]],
      "SHP-1047": [],
      "SHP-1048": [["needs_review", "review_update"]],
      "SHP-1049": [["delay", "notify_customer"]],
      "SHP-1050": [],
    });
  });

  it("folds the missing packing list into the customs hold, with it as the reason", () => {
    const [hold] = detectExceptions(seed("SHP-1043"), NOW);
    expect(hold?.actionReason).toBe("Customs needs the packing list");
    expect(hold?.severity).toBe("critical");
  });
});

describe("detectExceptions: timing", () => {
  it("gives critical items 30 minutes and warnings 2 hours from detection", () => {
    expect(RESPONSE_MINUTES).toEqual({ critical: 30, warning: 120 });
    for (const e of all.flatMap((s) => detectExceptions(s, NOW))) {
      const minutes = (Date.parse(e.respondBy) - Date.parse(e.detectedAt)) / 60_000;
      expect(minutes).toBe(RESPONSE_MINUTES[e.severity]);
    }
  });

  it("detects a stale shipment the moment its 24h ran out", () => {
    const [stale] = detectExceptions(seed("SHP-1045"), NOW);
    expect(stale?.impact).toBe("No update for 26h");
    expect(Date.parse(stale?.respondBy ?? "") - NOW.getTime()).toBeLessThan(10 * 60_000); // due in under 10 min
  });

  it("dates a hold and a delay by the operator report that revealed them", () => {
    expect(detectExceptions(seed("SHP-1043"), NOW)[0]?.detectedAt).toBe(minutesAgo(40));
    expect(detectExceptions(seed("SHP-1042"), NOW)[0]?.detectedAt).toBe(hoursAgo(1));
  });
});

describe("detectExceptions: delays", () => {
  it("sends a High-confidence AI delay to the operator: the customer was already alerted", () => {
    const [delay] = detectExceptions(seed("SHP-1042"), NOW);
    expect(delay).toMatchObject({ impact: "ETA +26h", suggestedAction: "contact_operator", confidence: 0.85 });
  });

  it("asks ops to notify the customer when the AI isn't sure enough to alert them (< 0.8)", () => {
    const [delay] = detectExceptions(seed("SHP-1046"), NOW);
    expect(delay).toMatchObject({ suggestedAction: "notify_customer", confidence: 0.75 });
  });

  it("counts days from two days late", () => {
    const s = seed("SHP-1049");
    const late = { ...s, operatorEta: { ...s.operatorEta, date: new Date(Date.parse(s.plannedEta) + 72 * 3_600_000).toISOString() } };
    expect(detectExceptions(late, NOW)[0]?.impact).toBe("ETA +3 days");
  });
});

describe("detectExceptions: other types", () => {
  it("asks for a required document that's missing outside a hold, and ignores optional ones", () => {
    const s = seed("SHP-1044");
    const docs = (required: boolean): Shipment => ({ ...s, documents: [{ type: "cmr", status: "missing", required }] });
    expect(found(docs(true))).toEqual([["missing_document", "request_document"]]);
    expect(found(docs(false))).toEqual([]);
  });

  it("only reviews the latest message: a clear one afterwards resolves it", () => {
    const s = seed("SHP-1048");
    const clear: RawEventRef = { operatorId: "op-saltwren", receivedAt: minutesAgo(5), channel: "api", original: "x", normalizedTo: "arrived", confidence: 1 };
    expect(found({ ...s, rawEvents: [...s.rawEvents, clear] })).toEqual([]);
  });

  it("never detects an incident: no data reports one yet", () => {
    expect(all.flatMap((s) => detectExceptions(s, NOW)).some((e) => e.type === "incident")).toBe(false);
    expect(severityOf("incident")).toBe("critical");
  });
});
