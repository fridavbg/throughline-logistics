import { describe, expect, it } from "vitest";
import { demoEvents } from "@/data/demoEvents";
import { operatorEmails } from "@/data/raw/email";
import { readEmail, STEP_CONFIDENCE, UNREAD_CONFIDENCE } from "@/lib/ai/normalizeText";

const read = (body: string, subject = "Shipment update") => readEmail(subject, body);

describe("readEmail: the demo's emails", () => {
  it("reads SHP-1043's email as a customs hold, plainly stated (0.9)", () => {
    const email = operatorEmails.find((e) => e.ref === "SHP-1043");
    if (!email) throw new Error("Missing SHP-1043 email");
    expect(readEmail(email.subject, email.body)).toEqual({
      milestone: "customs_hold",
      confidence: 0.9,
      note: 'Says "held by UK customs".',
    });
  });

  it("reads SHP-1048's demo email as arrived, but hedged, so 0.45 and under review", () => {
    const event = demoEvents.find((e) => e.id === "email-update")?.events[0]?.event;
    expect(event).toMatchObject({ normalizedTo: "arrived", confidence: 0.45 });
    expect(event?.readingNote).toBe('Says "vessel might call at", but hedged: "might", "depending".');
  });
});

describe("readEmail: steps", () => {
  it.each([
    ["The container was released by Spanish customs this morning.", "customs_cleared"],
    ["Goods are held by customs at Southampton.", "customs_hold"],
    ["The export declaration submitted today.", "customs_submitted"],
    ["Delivered to the consignee at 14:10.", "delivered"],
    ["Container discharged at Hamburg.", "discharged"],
    ["The vessel berthed in Rotterdam overnight.", "arrived"],
    ["MV Corra sailed from Valencia at 06:00.", "departed"],
    ["Your container is loaded.", "loaded"],
    ["Container gate-in completed.", "gate_in"],
    ["Truck is on the way to the port.", "in_transit"],
    ["Pallets collected from Terrassa.", "picked_up"],
  ] as const)("%s → %s", (body, milestone) => {
    expect(read(body)).toMatchObject({ milestone, confidence: STEP_CONFIDENCE });
  });

  it("reads the furthest step when several are named", () => {
    expect(read("Loaded and departed Valencia on schedule.").milestone).toBe("departed");
  });

  it("reads a release after a hold as cleared, not held", () => {
    expect(read("After being held by customs, it was released by customs at 09:00.").milestone).toBe("customs_cleared");
  });

  it("ignores case, and reads the subject too", () => {
    expect(readEmail("DELIVERED: SHP-1044", "See attached POD.").milestone).toBe("delivered");
  });

  it("quotes the words as the operator wrote them", () => {
    expect(read("Container DISCHARGED at Hamburg.").note).toBe('Says "DISCHARGED".');
  });

  it("reads a port call only from a vessel, not from 'please call at' (PR review finding)", () => {
    expect(read("The vessel called at Rotterdam this morning.").milestone).toBe("arrived");
    expect(read("Please call at 10:00 to discuss the invoice.").milestone).toBeNull();
    expect(read("Our driver will call at your warehouse tomorrow.").milestone).toBeNull();
  });

  it("doesn't read a step inside another word", () => {
    expect(read("Reloaded paperwork attached.").milestone).toBeNull();
  });
});

describe("readEmail: uncertainty", () => {
  it("halves the confidence for hedged wording, listing each hedge once", () => {
    expect(read("It might have berthed, or it might be at anchor, depending on the pilot.")).toEqual({
      milestone: "arrived",
      confidence: 0.45,
      note: 'Says "berthed", but hedged: "might", "depending".',
    });
  });

  it("reads no step from the future tense: only a step that has happened counts", () => {
    expect(read("The vessel will arrive in Hamburg on Friday.")).toMatchObject({ milestone: null, confidence: UNREAD_CONFIDENCE });
  });

  it("errs towards review: a hedge anywhere in the email lowers the whole reading", () => {
    // Loading did happen, but "expected to" about the next step still sends it to a person.
    expect(read("Loaded this morning, expected to depart Friday.")).toMatchObject({ milestone: "loaded", confidence: 0.45 });
  });

  it("reads nothing when the email says a step didn't happen", () => {
    expect(read("The goods were not delivered: nobody at the site.")).toEqual({
      milestone: null,
      confidence: UNREAD_CONFIDENCE,
      note: 'Says something didn\'t happen ("not"), so no step is read.',
    });
    expect(read("Driver couldn't load the trailer.").milestone).toBeNull();
    expect(read("Delivery failed, will retry.").milestone).toBeNull();
    expect(read("Package undelivered.").milestone).toBeNull();
  });

  it("reads nothing when the operator can't confirm the step (review finding)", () => {
    expect(read("We cannot confirm it departed yet.").milestone).toBeNull();
  });

  it("reads a lifted hold as cleared, never as a new hold (review finding)", () => {
    expect(read("Customs hold lifted, container free to go.").milestone).toBe("customs_cleared");
    expect(read("UK customs hold released at 09:00.").milestone).toBe("customs_cleared");
  });

  it("treats a question as a hedge (review finding)", () => {
    expect(read("Delivered? Please confirm.")).toMatchObject({ milestone: "delivered", confidence: 0.45 });
  });

  it("doesn't take the month of May for a hedge (review finding)", () => {
    expect(read("Departed Valencia on 3 May as planned.").confidence).toBe(STEP_CONFIDENCE);
    expect(read("May 3: departed Valencia.").confidence).toBe(STEP_CONFIDENCE);
    expect(read("It may have departed.").confidence).toBe(0.45);
  });

  it("allows a few words between 'held by' and 'customs' (review finding)", () => {
    expect(read("Held by UK Border Force customs at Southampton.").milestone).toBe("customs_hold");
  });

  it("reads nothing, at low confidence, when no step is mentioned", () => {
    expect(read("Hi, please call me back about the invoice.")).toEqual({
      milestone: null,
      confidence: UNREAD_CONFIDENCE,
      note: "No shipment step mentioned.",
    });
    expect(readEmail("", "")).toMatchObject({ milestone: null, confidence: UNREAD_CONFIDENCE });
  });
});
