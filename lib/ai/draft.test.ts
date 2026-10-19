import { describe, expect, it } from "vitest";
import { getMidDemoShipments } from "@/data/fixtures";
import { customers } from "@/data/seed";
import { draftNotification, messagesCustomer } from "@/lib/ai/draft";
import { detectExceptions } from "@/lib/exceptions";
import { formatDay, getNow } from "@/lib/time";
import type { Customer, Shipment } from "@/lib/types";

const NOW = getNow();

function seed(id: string): { s: Shipment; customer: Customer } {
  const s = getMidDemoShipments().find((x) => x.id === id);
  const customer = customers.find((c) => c.id === s?.customerId);
  if (!s || !customer) throw new Error(`Seed shipment ${id} or its customer is missing`);
  return { s, customer };
}

function draftFor(id: string) {
  const { s, customer } = seed(id);
  const [e] = detectExceptions(s, NOW);
  if (!e) throw new Error(`${id} has no exception`);
  return draftNotification(e, s, customer, NOW);
}

describe("draftNotification", () => {
  it("asks for the missing document on a customs hold, without promising a release date", () => {
    const draft = draftFor("SHP-1043");
    expect(draft?.subject).toBe("SHP-1043 is held by customs");
    expect(draft?.body).toContain("held by customs at Port of Southampton");
    expect(draft?.body).toContain("customs needs the packing list");
    expect(draft?.body).not.toMatch(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/); // no date
  });

  it("words an AI delay as our estimate, with the reason from the data", () => {
    const { s } = seed("SHP-1046");
    const body = draftFor("SHP-1046")?.body ?? "";
    expect(body).toContain("(our estimate)");
    expect(body).toContain(`later than the ${formatDay(s.plannedEta)} we planned`);
    expect(body).toContain("Reason: Vessel departed");
  });

  it("words an operator delay as the carrier's estimate, with no invented cause", () => {
    const body = draftFor("SHP-1049")?.body ?? "";
    expect(body).toContain("(the carrier's estimate)");
    expect(body).not.toContain("Reason:");
  });

  it("gives a delay within the planned day in hours, not 'Thu 22 Oct, later than Thu 22 Oct'", () => {
    const { s } = seed("SHP-1049");
    const day = formatDay(s.plannedEta);
    expect(draftFor("SHP-1049")?.body).toContain(`on ${day} (the carrier's estimate), about 14h later than planned.`);
    expect(draftFor("SHP-1049")?.body).not.toContain(`later than the ${day}`);
  });

  it("addresses the customer and links the draft to its exception and shipment", () => {
    expect(draftFor("SHP-1049")).toMatchObject({
      exceptionId: "SHP-1049-delay",
      shipmentId: "SHP-1049",
      customerId: "cust-ostrel-de",
    });
    expect(draftFor("SHP-1049")?.body).toMatch(/^Hello Ostrel Deutschland,/);
  });

  it("drafts nothing when the action isn't a message to the customer", () => {
    expect(draftFor("SHP-1042")).toBeUndefined(); // contact operator: the customer was alerted
    expect(draftFor("SHP-1045")).toBeUndefined(); // stale: an internal check
    expect(draftFor("SHP-1048")).toBeUndefined(); // needs review: an internal check
  });

  it("treats notifying and requesting as messages, the rest as internal", () => {
    expect(messagesCustomer("notify_customer")).toBe(true);
    expect(messagesCustomer("request_document")).toBe(true);
    expect(messagesCustomer("contact_operator")).toBe(false);
    expect(messagesCustomer("review_update")).toBe(false);
  });
});
