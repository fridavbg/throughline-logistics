import { describe, expect, it } from "vitest";
import { users } from "@/data/seed";
import { getShipments } from "@/data/shipments";
import { canView, findVisibleShipment, visibleShipments } from "@/lib/access";
import type { Shipment, User } from "@/lib/types";

const shipments = getShipments();

function persona(id: string): User {
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error(`Missing seed user ${id}`);
  return user;
}

const ids = (list: Shipment[]) => list.map((s) => s.id);

describe("visibleShipments for each demo persona", () => {
  it("shows the customer (Summer) only Ostrel Deutschland's shipments", () => {
    const visible = visibleShipments(persona("user-summer"), shipments);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((s) => s.customerId === "cust-ostrel-de")).toBe(true);
    expect(ids(visible)).toEqual(ids(shipments.filter((s) => s.customerId === "cust-ostrel-de")));
  });

  it("shows Terrassa ops (Morty) only shipments leaving Terrassa", () => {
    const visible = visibleShipments(persona("user-morty"), shipments);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan(shipments.length);
    expect(visible.every((s) => s.originSiteId === "site-terrassa")).toBe(true);
    expect(ids(visible)).toEqual(ids(shipments.filter((s) => s.originSiteId === "site-terrassa")));
  });

  it("shows the support lead (Rick) every shipment", () => {
    expect(ids(visibleShipments(persona("user-rick"), shipments))).toEqual(ids(shipments));
  });
});

describe("canView", () => {
  const shipment = shipments[0];
  if (!shipment) throw new Error("The seed has no shipments");

  it("doesn't let a customer see a shipment from the same site for another customer", () => {
    const other: User = { id: "u", name: "Other", role: "customer", customerId: "cust-pellow" };
    expect(canView(other, { ...shipment, customerId: "cust-ostrel-de" })).toBe(false);
  });

  it("doesn't let an ops user with no sites see anything", () => {
    const none: User = { id: "u", name: "Nobody", role: "ops", siteIds: [] };
    expect(visibleShipments(none, shipments)).toEqual([]);
  });

  it("lets an ops user with several sites see each of them", () => {
    const two: User = { id: "u", name: "Two", role: "ops", siteIds: ["site-porto", "site-zaragoza"] };
    const sites = new Set(visibleShipments(two, shipments).map((s) => s.originSiteId));
    expect(sites).toEqual(new Set(["site-porto", "site-zaragoza"]));
  });
});

describe("findVisibleShipment", () => {
  it("finds a shipment the persona may see", () => {
    expect(findVisibleShipment(persona("user-summer"), shipments, "SHP-1042")?.id).toBe("SHP-1042");
  });

  it("hides another customer's shipment exactly like an unknown id", () => {
    // SHP-1043 belongs to Thornquist, not Ostrel Deutschland.
    expect(findVisibleShipment(persona("user-summer"), shipments, "SHP-1043")).toBeUndefined();
    expect(findVisibleShipment(persona("user-summer"), shipments, "SHP-9999")).toBeUndefined();
  });

  it("hides shipments from other sites for a site-bound ops user", () => {
    // SHP-1043 leaves Zaragoza; Morty only sees Terrassa.
    expect(findVisibleShipment(persona("user-morty"), shipments, "SHP-1043")).toBeUndefined();
    expect(findVisibleShipment(persona("user-rick"), shipments, "SHP-1043")?.id).toBe("SHP-1043");
  });

  it("matches the id exactly", () => {
    expect(findVisibleShipment(persona("user-rick"), shipments, "shp-1042")).toBeUndefined();
    expect(findVisibleShipment(persona("user-rick"), shipments, "")).toBeUndefined();
  });
});
