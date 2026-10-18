/**
 * Simulated AI exception triage (A3). Scores each exception by severity × customer priority ×
 * how much of its response window has gone, says why in plain words, and orders the inbox.
 * Deterministic. The weights are starting values, to be tuned with ops feedback (RATIONALE §1).
 */
import { isOverdue } from "@/lib/derived";
import { detectExceptions } from "@/lib/exceptions";
import type { Customer, DetectedException, ExceptionType, Severity, Shipment, ShipmentException } from "@/lib/types";

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 1, warning: 0.6 };
export const PRIORITY_WEIGHT: Record<Customer["priority"], number> = { key: 1, standard: 0.8 };

/** Scores of overdue items start here; everything else stays below, so overdue is always on top. */
export const OVERDUE_BAND = 90;

/** An exception type in words, for reasons and labels, e.g. "Customs hold". */
export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  delay: "Delay",
  customs_hold: "Customs hold",
  stale: "Stale",
  missing_document: "Missing document",
  incident: "Incident",
  needs_review: "Needs review",
};

/**
 * Every exception across the shipments, highest score first; ties go to the earliest
 * deadline. Customers missing from the list count as standard priority.
 */
export function rankExceptions(shipments: Shipment[], customers: Customer[], now: Date): ShipmentException[] {
  const priorityOf = (s: Shipment) => customers.find((c) => c.id === s.customerId)?.priority ?? "standard";
  return shipments
    .flatMap((s) => detectExceptions(s, now).map((e) => scoreException(e, priorityOf(s), now)))
    .sort((a, b) => b.priorityScore - a.priorityScore || Date.parse(a.respondBy) - Date.parse(b.respondBy) || a.id.localeCompare(b.id));
}

/**
 * The triage score from 0 to 100, with its reason. Overdue: 90–100 by weight. Otherwise up to
 * 89: weight × urgency, where urgency grows from 0.5 (just detected) to 1 (deadline now), so a
 * fresh critical item still outranks an old warning.
 */
export function scoreException(e: DetectedException, priority: Customer["priority"], now: Date): ShipmentException {
  const weight = SEVERITY_WEIGHT[e.severity] * PRIORITY_WEIGHT[priority];
  const overdue = isOverdue(e, now);
  const priorityScore = overdue
    ? OVERDUE_BAND + Math.round((100 - OVERDUE_BAND) * weight)
    : Math.round((OVERDUE_BAND - 1) * weight * urgency(e, now));
  return { ...e, priorityScore, priorityReason: reason(e, priority, overdue, now) };
}

/** 0.5 when just detected, 1 at the deadline. */
function urgency(e: DetectedException, now: Date): number {
  const window = Date.parse(e.respondBy) - Date.parse(e.detectedAt);
  const used = window > 0 ? (now.getTime() - Date.parse(e.detectedAt)) / window : 1;
  return 0.5 + 0.5 * Math.min(Math.max(used, 0), 1);
}

/** E.g. "Overdue by 10 min · Critical: customs hold · Key customer". */
function reason(e: DetectedException, priority: Customer["priority"], overdue: boolean, now: Date): string {
  // Overdue rounds up and time left rounds down, so neither shows "0 min" while time is still on the clock.
  const msToDeadline = Date.parse(e.respondBy) - now.getTime();
  const time = overdue
    ? `Overdue by ${duration(Math.ceil(-msToDeadline / 60_000))}`
    : `${duration(Math.floor(msToDeadline / 60_000))} left to respond`;
  const severity = `${e.severity === "critical" ? "Critical" : "Warning"}: ${EXCEPTION_LABELS[e.type].toLowerCase()}`;
  const customer = priority === "key" ? "Key customer" : "Standard customer";
  return [time, severity, customer].join(" · ");
}

/** "8 min", "1h 20 min", "2h". */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m} min`;
}
