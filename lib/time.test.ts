import { describe, expect, it } from "vitest";
import { DEMO_NOW, getNow } from "@/lib/time";

describe("getNow", () => {
  it("returns the fixed demo time", () => {
    expect(getNow().toISOString()).toBe("2026-10-21T08:00:00.000Z");
  });

  it("returns a fresh copy, so callers can't shift the demo clock", () => {
    getNow().setFullYear(2000);

    expect(getNow().getTime()).toBe(DEMO_NOW.getTime());
  });
});
