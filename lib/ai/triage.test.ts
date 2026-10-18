import { describe, expect, it } from "vitest";
import { getShipments } from "@/data/shipments";
import { customers } from "@/data/seed";
import { rankExceptions, scoreException } from "@/lib/ai/triage";
import { getNow, minutesAgo, minutesFromNow } from "@/lib/time";
import type { DetectedException } from "@/lib/types";

const NOW = getNow();
const ranked = rankExceptions(getShipments(), customers, NOW);

/** A detected exception with a given severity, detected and due at the given times. */
function detected(severity: DetectedException["severity"], detectedAt: string, respondBy: string): DetectedException {
  return {
    id: `x-${severity}-${respondBy}`,
    shipmentId: "SHP-TEST",
    type: severity === "critical" ? "customs_hold" : "stale",
    detectedAt,
    severity,
    respondBy,
    impact: "",
    suggestedAction: "contact_operator",
    actionReason: "",
    confidence: 0.95,
  };
}

describe("rankExceptions: the seed at the demo time", () => {
  it("puts the overdue customs hold first, then the most pressing", () => {
    expect(ranked.map((e) => [e.shipmentId, e.type])).toEqual([
      ["SHP-1043", "customs_hold"],
      ["SHP-1045", "stale"],
      ["SHP-1046", "delay"],
      ["SHP-1042", "delay"],
      ["SHP-1049", "delay"],
      ["SHP-1048", "needs_review"],
    ]);
  });

  it("gives every item a reason", () => {
    expect(ranked[0]?.priorityReason).toBe("Overdue by 10 min · Critical: customs hold · Key customer");
    expect(ranked.at(-1)?.priorityReason).toBe("1h 45 min left to respond · Warning: needs review · Standard customer");
    expect(ranked.every((e) => e.priorityReason.length > 0)).toBe(true);
  });

  it("scores from 0 to 100", () => {
    expect(ranked.every((e) => e.priorityScore >= 0 && e.priorityScore <= 100)).toBe(true);
  });
});

describe("scoreException", () => {
  it("ranks any overdue item above any item still in time", () => {
    const overdueWarning = scoreException(detected("warning", minutesAgo(200), minutesAgo(1)), "standard", NOW);
    const dueCritical = scoreException(detected("critical", minutesAgo(29), minutesFromNow(1)), "key", NOW);
    expect(overdueWarning.priorityScore).toBeGreaterThan(dueCritical.priorityScore);
    expect(overdueWarning.priorityScore).toBeGreaterThanOrEqual(90);
    expect(dueCritical.priorityScore).toBeLessThan(90);
  });

  it("is not overdue exactly at the deadline", () => {
    const e = scoreException(detected("warning", minutesAgo(120), NOW.toISOString()), "key", NOW);
    expect(e.priorityScore).toBeLessThan(90);
    expect(e.priorityReason).toMatch(/^0 min left to respond/);
  });

  it("never says 'Overdue by 0 min' just after the deadline", () => {
    const justLate = scoreException(detected("critical", minutesAgo(31), new Date(NOW.getTime() - 20_000).toISOString()), "key", NOW);
    expect(justLate.priorityReason).toMatch(/^Overdue by 1 min/);
  });

  it("weighs critical over warning and key over standard customers", () => {
    const at = (sev: DetectedException["severity"], prio: "key" | "standard") =>
      scoreException(detected(sev, minutesAgo(10), minutesFromNow(20)), prio, NOW).priorityScore;
    expect(at("critical", "standard")).toBeGreaterThan(at("warning", "standard"));
    expect(at("warning", "key")).toBeGreaterThan(at("warning", "standard"));
  });

  it("grows as the deadline nears", () => {
    const fresh = scoreException(detected("warning", minutesAgo(1), minutesFromNow(119)), "key", NOW);
    const nearly = scoreException(detected("warning", minutesAgo(110), minutesFromNow(10)), "key", NOW);
    expect(nearly.priorityScore).toBeGreaterThan(fresh.priorityScore);
  });

  it("orders ties by the earliest deadline, so the order never depends on input order", () => {
    const reversed = rankExceptions([...getShipments()].reverse(), customers, NOW);
    expect(reversed.map((e) => e.id)).toEqual(ranked.map((e) => e.id));
  });
});
