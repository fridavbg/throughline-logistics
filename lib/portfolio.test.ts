import { describe, expect, it } from "vitest";
import { getMidDemoShipments } from "@/data/fixtures";
import { customers, operators, sites, users } from "@/data/seed";
import { visibleShipments } from "@/lib/access";
import { portfolioRows } from "@/lib/portfolio";
import { getNow } from "@/lib/time";

const NOW = getNow();
const names = { customers, sites, operators };
const all = getMidDemoShipments();
const rows = portfolioRows(all, names, NOW);
const ids = (list: typeof rows) => list.map((r) => r.view.shipment.id);

describe("portfolioRows", () => {
  it("lists every shipment, not only those that need attention, late first and delivered last", () => {
    expect(ids(rows)).toEqual([
      "SHP-1042",
      "SHP-1049",
      "SHP-1046",
      "SHP-1043",
      "SHP-1045",
      "SHP-1044",
      "SHP-1048",
      "SHP-1050",
      "SHP-1047",
    ]);
  });

  it("puts names on the ids, and the current leg's mode and operator", () => {
    expect(rows[0]).toMatchObject({
      customer: "Ostrel Deutschland",
      origin: "Terrassa Plant",
      destination: "Ostrel Deutschland, Hamburg",
      current: { mode: "sea", operator: "Saltwren Lines" },
    });
  });

  it("shows the last leg once delivered", () => {
    expect(rows.find((r) => r.view.shipment.id === "SHP-1047")?.current).toEqual({ mode: "road", operator: "Quickfern" });
  });

  it("carries the same ETA as the detail page, AI source included", () => {
    expect(rows[0]?.view.eta).toEqual({ status: "late", source: "ai_predicted" });
    expect(rows.find((r) => r.view.shipment.id === "SHP-1043")?.view.status).toBe("customs_hold");
  });

  it("only covers the shipments it's given, so a site persona sees their own sites", () => {
    const morty = users.find((u) => u.id === "user-morty");
    if (!morty) throw new Error("Seed persona user-morty is missing");
    const mine = portfolioRows(visibleShipments(morty, all), names, NOW);
    expect(ids(mine)).toEqual(["SHP-1042", "SHP-1046", "SHP-1044", "SHP-1048"]);
    expect(mine.every((r) => r.origin === "Terrassa Plant")).toBe(true);
  });

  it("falls back to the id when a name is missing, so the row still shows", () => {
    const [row] = portfolioRows(all.slice(0, 1), { customers: [], sites: [], operators: [] }, NOW);
    expect(row?.customer).toBe(all[0]?.customerId);
    expect(row?.origin).toBe(all[0]?.originSiteId);
  });
});
