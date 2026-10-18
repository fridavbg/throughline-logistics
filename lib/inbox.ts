/**
 * The ops attention inbox (F2): ranked exceptions with what a row needs to show (customer,
 * origin site, route, draft), the filters, and the response countdown. Pure, so it's tested
 * without React. Spec: docs/PRD.md §4 (F2), docs/DESIGN.md §6 (ExceptionRow).
 */
import { draftNotification } from "@/lib/ai/draft";
import { rankExceptions } from "@/lib/ai/triage";
import { isOverdue } from "@/lib/derived";
import { formatDuration } from "@/lib/time";
import type { Customer, CustomerAlert, ExceptionType, NotificationDraft, Shipment, ShipmentException, Site } from "@/lib/types";

/** Under this many minutes left, the countdown turns amber. */
export const SOON_MINUTES = 10;

/** One inbox row. */
export type InboxItem = {
  exception: ShipmentException;
  shipment: Shipment;
  customer: Customer | undefined;
  site: Site | undefined;
  /** For actions that write to the customer; ops edits and approves it. */
  draft: NotificationDraft | undefined;
};

/** "all", or one value to keep. */
export type InboxFilter = { type: ExceptionType | "all"; siteId: string };

export const NO_FILTER: InboxFilter = { type: "all", siteId: "all" };

/**
 * The ranked inbox for the given shipments (already filtered to the persona's perimeter),
 * without what ops has handled. Most urgent first, as triage ranks it.
 */
export function inboxItems(
  shipments: Shipment[],
  customers: Customer[],
  sites: Site[],
  handledIds: readonly string[],
  now: Date,
): InboxItem[] {
  const byId = new Map(shipments.map((s) => [s.id, s]));
  return rankExceptions(shipments, customers, now).flatMap((exception) => {
    const shipment = byId.get(exception.shipmentId);
    if (!shipment || handledIds.includes(exception.id)) return [];
    const customer = customers.find((c) => c.id === shipment.customerId);
    return [{
      exception,
      shipment,
      customer,
      site: sites.find((site) => site.id === shipment.originSiteId),
      draft: customer && draftNotification(exception, shipment, customer, now),
    }];
  });
}

/** Keeps the rows that match both filters, in the same order. */
export function filterInbox(items: InboxItem[], filter: InboxFilter): InboxItem[] {
  return items.filter(
    (item) =>
      (filter.type === "all" || item.exception.type === filter.type) &&
      (filter.siteId === "all" || item.shipment.originSiteId === filter.siteId),
  );
}

/** The response countdown: "Overdue · escalated" (red), "Respond within 8 min" (amber under 10), or calm. */
export function responseLabel(e: ShipmentException, now: Date): { text: string; tone: "overdue" | "soon" | "normal" } {
  if (isOverdue(e, now)) return { text: "Overdue · escalated", tone: "overdue" };
  const minutes = Math.floor((Date.parse(e.respondBy) - now.getTime()) / 60_000);
  return { text: `Respond within ${formatDuration(minutes)}`, tone: minutes < SOON_MINUTES ? "soon" : "normal" };
}

/** Origin site to destination, e.g. "Zaragoza Warehouse → Thornquist Tools, Manchester". */
export function routeLabel(item: InboxItem): string {
  const from = item.site?.name ?? item.shipment.legs[0]?.from.name ?? "Origin unknown";
  const to = item.shipment.legs.at(-1)?.to.name ?? "destination unknown";
  return `${from} → ${to}`;
}

/**
 * The customer alert for a message ops approved, with the text as ops edited it. Only built on
 * approval: nothing reaches a customer without it (PRD §6).
 */
export function approvedAlert(draft: NotificationDraft, severity: ShipmentException["severity"], text: string, now: Date): CustomerAlert {
  return {
    id: sentAlertId(draft.exceptionId),
    shipmentId: draft.shipmentId,
    severity: severity === "critical" ? "critical" : "warning",
    message: text.trim(),
    createdAt: now.toISOString(),
    source: "confirmed",
  };
}

/** The id of the alert sent for an exception, so other views can tell that a message went out. */
export function sentAlertId(exceptionId: string): string {
  return `sent-${exceptionId}`;
}
