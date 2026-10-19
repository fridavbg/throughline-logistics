import { describe, expect, it } from "vitest";
import { getMidDemoShipments } from "@/data/fixtures";
import { customers, sites, users } from "@/data/seed";
import { visibleShipments } from "@/lib/access";
import { approvedAlert, filterInbox, inboxItems, NO_FILTER, responseLabel, routeLabel } from "@/lib/inbox";
import { getNow } from "@/lib/time";

const NOW = getNow();
const all = getMidDemoShipments();
const items = inboxItems(all, customers, sites, [], NOW);
const ids = (list: typeof items) => list.map((i) => i.exception.id);

describe("inboxItems", () => {
  it("lists the ranked exceptions with the overdue customs hold first", () => {
    expect(ids(items)).toEqual([
      "SHP-1043-customs_hold",
      "SHP-1045-stale",
      "SHP-1046-delay",
      "SHP-1042-delay",
      "SHP-1049-delay",
      "SHP-1048-needs_review",
    ]);
  });

  it("drops what ops has handled", () => {
    expect(ids(inboxItems(all, customers, sites, ["SHP-1043-customs_hold"], NOW))[0]).toBe("SHP-1045-stale");
  });

  it("only covers the shipments it's given, so a site persona sees a shorter inbox", () => {
    const morty = users.find((u) => u.id === "user-morty");
    if (!morty) throw new Error("Seed persona user-morty is missing");
    expect(ids(inboxItems(visibleShipments(morty, all), customers, sites, [], NOW))).toEqual([
      "SHP-1046-delay",
      "SHP-1042-delay",
      "SHP-1048-needs_review",
    ]);
  });

  it("attaches a draft only where the action writes to the customer", () => {
    const withDraft = items.filter((i) => i.draft).map((i) => i.exception.id);
    expect(withDraft).toEqual(["SHP-1043-customs_hold", "SHP-1046-delay", "SHP-1049-delay"]);
  });
});

describe("filterInbox", () => {
  it("keeps everything with no filter", () => {
    expect(filterInbox(items, NO_FILTER)).toEqual(items);
  });

  it("filters by exception type and by origin site, together", () => {
    expect(ids(filterInbox(items, { type: "delay", siteId: "all" }))).toEqual(["SHP-1046-delay", "SHP-1042-delay", "SHP-1049-delay"]);
    expect(ids(filterInbox(items, { type: "all", siteId: "site-porto" }))).toEqual(["SHP-1045-stale"]);
    expect(ids(filterInbox(items, { type: "delay", siteId: "site-zaragoza" }))).toEqual(["SHP-1049-delay"]);
    expect(filterInbox(items, { type: "incident", siteId: "all" })).toEqual([]);
  });
});

describe("responseLabel", () => {
  const label = (id: string) => {
    const item = items.find((i) => i.exception.id === id);
    if (!item) throw new Error(`${id} is missing`);
    return responseLabel(item.exception, NOW);
  };

  it("says overdue and escalated past the deadline", () => {
    expect(label("SHP-1043-customs_hold")).toEqual({ text: "Overdue · escalated", tone: "overdue" });
  });

  it("turns amber under 10 minutes left", () => {
    expect(label("SHP-1045-stale")).toEqual({ text: "Respond within 8 min", tone: "soon" });
  });

  it("stays calm with time to spare", () => {
    expect(label("SHP-1049-delay")).toEqual({ text: "Respond within 1h 20 min", tone: "normal" });
  });
});

describe("routeLabel and approvedAlert", () => {
  it("names the origin site and the destination", () => {
    expect(routeLabel(items[0]!)).toBe("Zaragoza Warehouse → Thornquist Tools, Manchester");
  });

  it("sends the message as ops edited it, marked as confirmed, never as AI", () => {
    const item = items.find((i) => i.draft);
    if (!item?.draft) throw new Error("No draft in the seed");
    const alert = approvedAlert(item.draft, "critical", "  Edited by ops.  ", NOW);
    expect(alert).toEqual({
      id: "sent-SHP-1043-customs_hold",
      shipmentId: "SHP-1043",
      severity: "critical",
      message: "Edited by ops.",
      createdAt: NOW.toISOString(),
      source: "confirmed",
    });
  });
});
