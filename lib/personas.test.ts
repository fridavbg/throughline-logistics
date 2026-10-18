import { describe, expect, it } from "vitest";
import { customers, sites, users } from "@/data/seed";
import { homePath, perimeterLabel, redirectFor, roleLabel } from "@/lib/personas";
import type { User } from "@/lib/types";

const summer: User = { id: "u1", name: "Summer", role: "customer", customerId: "cust-ostrel-de" };
const morty: User = { id: "u2", name: "Morty", role: "ops", siteIds: ["site-terrassa"] };
const rick: User = { id: "u3", name: "Rick", role: "ops", siteIds: "all" };

describe("homePath", () => {
  it("sends customers to their shipments and ops to the attention inbox", () => {
    expect(homePath("customer")).toBe("/customer");
    expect(homePath("ops")).toBe("/ops");
  });
});

describe("redirectFor", () => {
  it("sends someone without a persona to the picker", () => {
    expect(redirectFor(undefined, "ops")).toBe("/");
    expect(redirectFor(undefined, "customer")).toBe("/");
  });

  it("sends a persona on another role's page to their own home", () => {
    expect(redirectFor(summer, "ops")).toBe("/customer");
    expect(redirectFor(rick, "customer")).toBe("/ops");
  });

  it("lets a persona stay on their own role's page", () => {
    expect(redirectFor(summer, "customer")).toBeNull();
    expect(redirectFor(morty, "ops")).toBeNull();
  });
});

describe("roleLabel", () => {
  it("calls an ops user with every site the support lead", () => {
    expect(roleLabel(summer)).toBe("Customer");
    expect(roleLabel(morty)).toBe("Operations");
    expect(roleLabel(rick)).toBe("Support lead");
  });
});

describe("perimeterLabel", () => {
  it("names the customer, the sites, or all sites", () => {
    expect(perimeterLabel(summer, sites, customers)).toBe("Ostrel Deutschland");
    expect(perimeterLabel(morty, sites, customers)).toBe("Terrassa Plant");
    expect(perimeterLabel(rick, sites, customers)).toBe("All sites");
  });

  it("lists several sites in order", () => {
    const user: User = { ...morty, siteIds: ["site-porto", "site-terrassa"] };
    expect(perimeterLabel(user, sites, customers)).toBe("Porto Plant, Terrassa Plant");
  });

  it("shows an unknown id as itself instead of dropping it", () => {
    const user: User = { ...morty, siteIds: ["site-nowhere"] };
    expect(perimeterLabel(user, sites, customers)).toBe("site-nowhere");
    expect(perimeterLabel({ ...summer, customerId: "cust-nobody" }, sites, customers)).toBe("cust-nobody");
  });

  it("has a readable label for every seed persona", () => {
    for (const user of users) {
      expect(perimeterLabel(user, sites, customers)).not.toMatch(/^(site|cust)-/);
    }
  });
});
