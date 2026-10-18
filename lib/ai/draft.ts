/**
 * Simulated AI customer notification drafts (A4). One template per exception type, filled
 * only with facts from the shipment; predictions are worded as estimates and nothing is
 * promised that the data doesn't say. An ops user edits and approves; nothing is sent
 * automatically (PRD §6).
 */
import { REVIEW_BELOW } from "@/lib/ai/confidence";
import { predictEta } from "@/lib/ai/eta";
import { DOCUMENT_NAMES } from "@/lib/exceptions";
import { formatDay, HOUR_MS } from "@/lib/time";
import type { Customer, DetectedException, NextAction, NotificationDraft, Shipment } from "@/lib/types";

/** Whether an action means writing to the customer, so it comes with a draft. */
export function messagesCustomer(action: NextAction): boolean {
  switch (action) {
    case "notify_customer":
    case "request_document":
      return true;
    case "contact_operator":
    case "review_update":
      return false;
    default: {
      const unhandled: never = action;
      throw new Error(`Unhandled action: ${String(unhandled)}`);
    }
  }
}

/** The draft for an exception whose action writes to the customer, otherwise `undefined`. */
export function draftNotification(e: DetectedException, s: Shipment, customer: Customer, now: Date): NotificationDraft | undefined {
  if (!messagesCustomer(e.suggestedAction)) return undefined;
  const message = template(e, s, now);
  if (!message) return undefined;
  const body = `Hello ${customer.name},\n\n${message.text}\n\nKind regards,\nCustomer service`;
  return { exceptionId: e.id, shipmentId: s.id, customerId: customer.id, subject: message.subject, body };
}

function template(e: DetectedException, s: Shipment, now: Date): { subject: string; text: string } | undefined {
  const destination = s.legs.at(-1)?.to.name ?? "its destination";
  switch (e.type) {
    case "delay":
      return {
        subject: `Update on ${s.id}: later arrival expected`,
        text: `${s.id} to ${destination} is now expected to arrive ${expected(s, now)}.${cause(s, now)}\n\nWe're following it closely and will let you know if anything changes.`,
      };
    case "customs_hold": {
      const missing = missingNames(s);
      const ask = missing
        ? `To release it, customs needs the ${missing}. Could you send it to us as soon as possible?`
        : "We're working with the operator to find out what customs needs.";
      return {
        subject: `${s.id} is held by customs`,
        text: `${s.id} is held by customs at ${holdPlace(s)}. ${ask}\n\nWe'll tell you as soon as it's released.`,
      };
    }
    case "missing_document":
      return {
        subject: `Document needed for ${s.id}`,
        text: `Could you send us the ${missingNames(s) ?? "missing documents"} for ${s.id} to ${destination}? We need it on file before the shipment can continue.`,
      };
    case "incident":
      return {
        subject: `Issue with ${s.id}`,
        text: `We're aware of an issue with ${s.id} and are looking into it. We'll update you as soon as we know more.`,
      };
    case "stale":
    case "needs_review":
      // Internal data checks: nothing to tell the customer until ops knows more.
      return undefined;
    default: {
      const unhandled: never = e.type;
      throw new Error(`Unhandled exception type: ${String(unhandled)}`);
    }
  }
}

/**
 * The arrival in words, by who says so, against the plan: "on Sun 25 Oct (our estimate),
 * later than the Sat 24 Oct we planned". A delay within the planned day is given in hours,
 * since "Thu 22 Oct, later than Thu 22 Oct" says nothing.
 */
function expected(s: Shipment, now: Date): string {
  const p = predictEta(s, now);
  const trusted = p && p.confidence >= REVIEW_BELOW ? p : undefined;
  const latest = trusted?.latest ?? s.operatorEta.date;
  const who = trusted ? " (our estimate)" : s.operatorEta.source === "confirmed" ? "" : " (the carrier's estimate)";
  const planned = formatDay(s.plannedEta);
  const [from, to] = [formatDay(trusted?.earliest ?? latest), formatDay(latest)];
  if (to === planned) {
    // At least 1h: at risk means later than planned, so "about 0h later" would contradict it.
    const hours = Math.max(1, Math.round((Date.parse(latest) - Date.parse(s.plannedEta)) / HOUR_MS));
    return `on ${to}${who}, about ${hours}h later than planned`;
  }
  const when = from === to ? `on ${to}` : `between ${from} and ${to}`;
  return `${when}${who}, later than the ${planned} we planned`;
}

/** The known cause, from the AI's reason, e.g. " Reason: Vessel departed 24h late from Port of Barcelona." */
function cause(s: Shipment, now: Date): string {
  const p = predictEta(s, now);
  return p && p.confidence >= REVIEW_BELOW ? ` Reason: ${p.reason}.` : "";
}

function missingNames(s: Shipment): string | undefined {
  const names = s.documents.filter((d) => d.required && d.status === "missing").map((d) => DOCUMENT_NAMES[d.type]);
  return names.length ? names.join(" and ") : undefined;
}

/** Customs steps happen at the arrival port of the leg they're on. */
function holdPlace(s: Shipment): string {
  const leg = s.legs.find((l) => l.milestones.some((m) => m.type === "customs_hold" && m.at !== null));
  return leg?.to.name ?? "the border";
}
