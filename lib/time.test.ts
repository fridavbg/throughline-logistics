import { describe, expect, it } from "vitest";
import {
  DEMO_NOW,
  formatDay,
  daysAgo,
  daysFromNow,
  getNow,
  hoursAgo,
  hoursFromNow,
  minutesAgo,
  minutesFromNow,
} from "@/lib/time";

describe("getNow", () => {
  it("returns the fixed demo time", () => {
    expect(getNow().toISOString()).toBe("2026-10-21T08:00:00.000Z");
  });

  it("returns a fresh copy, so callers can't shift the demo clock", () => {
    getNow().setFullYear(2000);

    expect(getNow().getTime()).toBe(DEMO_NOW.getTime());
  });
});

// DEMO_NOW is 2026-10-21T08:00:00Z.
describe("relative time helpers", () => {
  it("returns ISO timestamps in the past", () => {
    expect(minutesAgo(25)).toBe("2026-10-21T07:35:00.000Z");
    expect(hoursAgo(31)).toBe("2026-10-20T01:00:00.000Z");
    expect(daysAgo(3)).toBe("2026-10-18T08:00:00.000Z");
  });

  it("returns ISO timestamps in the future", () => {
    expect(minutesFromNow(90)).toBe("2026-10-21T09:30:00.000Z");
    expect(hoursFromNow(6)).toBe("2026-10-21T14:00:00.000Z");
    expect(daysFromNow(2)).toBe("2026-10-23T08:00:00.000Z");
  });

  it("returns the demo time itself for zero", () => {
    expect(hoursAgo(0)).toBe(DEMO_NOW.toISOString());
    expect(daysFromNow(0)).toBe(DEMO_NOW.toISOString());
  });

  it("adds exactly 24h per day across the DST change on 25 Oct", () => {
    expect(daysFromNow(5)).toBe("2026-10-26T08:00:00.000Z");
  });

  it("does not move the demo clock", () => {
    daysFromNow(10);

    expect(getNow().getTime()).toBe(DEMO_NOW.getTime());
  });
});

describe("formatDay", () => {
  it("shows the day as it falls in Spain, not on the machine running the code", () => {
    expect(formatDay("2026-10-23T12:00:00Z")).toBe("Fri 23 Oct");
    // 23:30 UTC is already the next day in Spain.
    expect(formatDay("2026-10-22T23:30:00Z")).toBe("Fri 23 Oct");
  });

  it("says the date is unknown instead of throwing on a bad value", () => {
    expect(formatDay("not-a-date")).toBe("date unknown");
  });
});
