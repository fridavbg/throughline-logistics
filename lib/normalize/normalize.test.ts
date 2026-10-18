import { describe, expect, it } from "vitest";
import { corvalaSamples } from "@/data/raw/corvala";
import { quickfernSamples } from "@/data/raw/quickfern";
import { saltwrenSamples } from "@/data/raw/saltwren";
import { normalizeCorvala } from "@/lib/normalize/corvala";
import { normalizeQuickfern } from "@/lib/normalize/quickfern";
import { normalizeSaltwren } from "@/lib/normalize/saltwren";

describe("normalizeCorvala", () => {
  it("reads a known status code with full confidence and keeps the original", () => {
    const payload = { shipment_ref: "SHP-1042", status_code: 30, ts: "2026-10-17T08:15:00+02:00" };
    const { shipmentId, event } = normalizeCorvala(payload);

    expect(shipmentId).toBe("SHP-1042");
    expect(event).toMatchObject({
      operatorId: "op-corvala",
      channel: "api",
      normalizedTo: "delivered",
      confidence: 1,
      receivedAt: "2026-10-17T06:15:00.000Z",
      original: JSON.stringify(payload),
    });
  });

  it("turns an unknown code into null with no confidence", () => {
    const { event } = normalizeCorvala({ shipment_ref: "SHP-1042", status_code: 45, ts: "2026-10-17T08:15:00Z" });

    expect(event.normalizedTo).toBeNull();
    expect(event.confidence).toBe(0);
  });
});

describe("normalizeSaltwren", () => {
  it("reads the event code and the UTC time, and keeps the line", () => {
    const { shipmentId, event } = normalizeSaltwren("SHP-1042|DEP|ESVLC|202610180630");

    expect(shipmentId).toBe("SHP-1042");
    expect(event).toMatchObject({
      operatorId: "op-saltwren",
      channel: "edi",
      normalizedTo: "departed",
      confidence: 1,
      receivedAt: "2026-10-18T06:30:00.000Z",
      original: "SHP-1042|DEP|ESVLC|202610180630",
    });
  });

  it("turns an unknown event code into null with no confidence", () => {
    const { event } = normalizeSaltwren("SHP-1042|RFT|ESVLC|202610180630");

    expect(event.normalizedTo).toBeNull();
    expect(event.confidence).toBe(0);
  });

  it("rejects a line that isn't in Saltwren's format, naming the line", () => {
    expect(() => normalizeSaltwren("SHP-1042|DEP")).toThrow('Not a Saltwren event line: "SHP-1042|DEP"');
  });
});

describe("normalizeQuickfern", () => {
  const read = (update: string) =>
    normalizeQuickfern({ ref: "SHP-1047", update, time: "2026-10-20T15:40:00Z" }).event;

  it("reads free text by keyword, less certain than a status code", () => {
    const event = read("Delivered - signed by R. Gomez");

    expect(event.normalizedTo).toBe("delivered");
    expect(event.confidence).toBe(0.9);
    expect(event.original).toContain("Delivered - signed by R. Gomez");
  });

  it.each([
    ["Collected at Zaragoza Warehouse", "picked_up"],
    ["On the way to Murcia", "in_transit"],
    ["Out for delivery", "in_transit"],
  ])("reads %j as %s", (update, milestone) => {
    expect(read(update).normalizedTo).toBe(milestone);
  });

  it.each([
    "Not delivered - customer closed",
    "Delivery attempted, nobody home",
    "Couldn't deliver, will retry",
    "Pickup failed",
  ])("never reads a failure as the milestone: %j", (update) => {
    const event = read(update);

    expect(event.normalizedTo).toBeNull();
    expect(event.confidence).toBeLessThan(0.6);
  });

  it("turns text it can't read into null with low confidence", () => {
    const event = read("Driver called, will update");

    expect(event.normalizedTo).toBeNull();
    expect(event.confidence).toBeLessThan(0.6);
  });
});

describe("sample payloads in data/raw", () => {
  const events = [
    ...corvalaSamples.map(normalizeCorvala),
    ...saltwrenSamples.map(normalizeSaltwren),
    ...quickfernSamples.map(normalizeQuickfern),
  ].map((e) => e.event);

  it("all become a milestone or null, with a confidence between 0 and 1", () => {
    for (const event of events) {
      expect(event.normalizedTo === null || typeof event.normalizedTo === "string").toBe(true);
      expect(event.confidence).toBeGreaterThanOrEqual(0);
      expect(event.confidence).toBeLessThanOrEqual(1);
      expect(event.original.length).toBeGreaterThan(0);
    }
  });

  it("include at least one unreadable message per operator, for the review path", () => {
    const unreadable = new Set(events.filter((e) => e.normalizedTo === null).map((e) => e.operatorId));
    expect(unreadable).toEqual(new Set(["op-corvala", "op-saltwren", "op-quickfern"]));
  });
});
