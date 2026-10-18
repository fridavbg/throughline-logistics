import { describe, expect, it } from "vitest";
import { DEMO_NOW, getNow } from "@/lib/time";

describe("getNow", () => {
  it("returns the fixed demo time", () => {
    // Deliberately wrong to prove CI fails on a test error. Revert before merge.
    expect(getNow().toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });

  it("returns a fresh copy, so callers can't shift the demo clock", () => {
    getNow().setFullYear(2000);

    expect(getNow().getTime()).toBe(DEMO_NOW.getTime());
  });
});
