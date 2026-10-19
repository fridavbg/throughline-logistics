// The demo store's own rules (F6): triggering an event, resetting the demo, and what a reload
// keeps. Everything the views show is derived from the shipments, which data/demoEvents.test.ts
// covers.
import { beforeEach, describe, expect, it } from "vitest";
import { savedState, useDemoStore } from "@/lib/store";
import type { CustomerAlert } from "@/lib/types";

const store = useDemoStore.getState;

const alert: CustomerAlert = {
  id: "sent-SHP-1042-delay",
  shipmentId: "SHP-1042",
  severity: "warning",
  message: "Your shipment is delayed.",
  createdAt: "2026-10-21T08:00:00.000Z",
  source: "confirmed",
};

beforeEach(() => {
  store().resetDemo();
  store().signIn("user-rick");
});

describe("trigger", () => {
  it("records each event once, in the order triggered", () => {
    store().trigger("email-update");
    store().trigger("vessel-delayed");
    store().trigger("email-update");
    expect(store().triggeredEventIds).toEqual(["email-update", "vessel-delayed"]);
  });

  it("leaves the state untouched on a repeat, so nothing re-renders", () => {
    store().trigger("vessel-delayed");
    const before = store().triggeredEventIds;
    store().trigger("vessel-delayed");
    expect(store().triggeredEventIds).toBe(before);
  });
});

describe("resetDemo", () => {
  it("clears demo events and everything ops did, but keeps the persona", () => {
    store().trigger("vessel-delayed");
    store().handle("SHP-1045-stale");
    store().send("SHP-1042-delay", alert);
    store().resetDemo();
    expect(store()).toMatchObject({
      triggeredEventIds: [],
      handledIds: [],
      settledIds: [],
      sentAlerts: [],
      userId: "user-rick",
    });
  });
});

describe("savedState", () => {
  it("saves the persona and what happened in the demo, so a reload keeps both", () => {
    store().trigger("vessel-delayed");
    store().send("SHP-1042-delay", alert);
    expect(savedState(store())).toEqual({
      userId: "user-rick",
      handledIds: ["SHP-1042-delay"],
      settledIds: ["SHP-1042-delay"],
      sentAlerts: [alert],
      triggeredEventIds: ["vessel-delayed"],
    });
  });

  it("never saves hasHydrated, so every page load waits for the saved state again", () => {
    expect(savedState(store())).not.toHaveProperty("hasHydrated");
  });

  it("saves the reset state after Reset demo, so a reload doesn't bring old actions back", () => {
    store().handle("SHP-1045-stale");
    store().resetDemo();
    expect(savedState(store())).toMatchObject({ handledIds: [], triggeredEventIds: [] });
  });
});
