import { describe, expect, it } from "vitest";
import { confidenceLevel } from "@/lib/ai/confidence";

describe("confidenceLevel", () => {
  it("is high from 0.8 up", () => {
    expect(confidenceLevel(0.8)).toBe("high");
    expect(confidenceLevel(1)).toBe("high");
  });

  it("is medium from 0.6 up to just below 0.8", () => {
    expect(confidenceLevel(0.6)).toBe("medium");
    expect(confidenceLevel(0.79)).toBe("medium");
  });

  it("needs review below 0.6", () => {
    expect(confidenceLevel(0.59)).toBe("needs_review");
    expect(confidenceLevel(0)).toBe("needs_review");
  });

  it("needs review when the score isn't between 0 and 1, so bad data never looks confident", () => {
    expect(confidenceLevel(Number.NaN)).toBe("needs_review");
    expect(confidenceLevel(1.2)).toBe("needs_review");
    expect(confidenceLevel(82)).toBe("needs_review");
    expect(confidenceLevel(-0.1)).toBe("needs_review");
  });
});
