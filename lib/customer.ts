/**
 * The customer's "My shipments" view (F4): each shipment with its status, ETA status, AI
 * prediction and summary, in the order a customer needs them, plus counts and proactive
 * alerts. Pure and computed every time, so a simulated event can't leave it out of date.
 * Spec: docs/PRD.md §4 (F4) and §6 (delivery tiers).
 */
import { HIGH_CONFIDENCE, REVIEW_BELOW } from "@/lib/ai/confidence";
import { predictEta } from "@/lib/ai/eta";
import { messagesCustomer } from "@/lib/ai/draft";
import { summarizeShipment } from "@/lib/ai/summarize";
import { getEtaStatus, getFurthestStep, getLastUpdateAt, getShipmentStatus, isDelayed, isOverdue } from "@/lib/derived";
import { formatDayRange, HOUR_MS } from "@/lib/time";
import type {
  CustomerAlert,
  EtaPrediction,
  EtaStatus,
  EtaStatusWithSource,
  OperatorSource,
  Shipment,
  ShipmentException,
  ShipmentStatus,
  ShipmentSummary,
} from "@/lib/types";

/** Delivered shipments stay in the view and the counts for this many days. */
export const DELIVERED_SHOWN_DAYS = 30;

/** One shipment as the customer sees it. */
export type CustomerShipment = {
  shipment: Shipment;
  status: ShipmentStatus;
  eta: EtaStatusWithSource;
  /** Only a prediction firm enough to show (confidence ≥ 0.6); below that the customer sees the operator's ETA. */
  prediction?: EtaPrediction;
  summary: ShipmentSummary;
  /** When it was delivered and who says so, or `undefined` while it's on its way. */
  delivery?: { at: string; source: OperatorSource };
};

/** The summary bar: active shipments by ETA status, plus recent deliveries. */
export type EtaCounts = Record<EtaStatus, number> & { delivered: number };

/**
 * The customer's shipments, late first, then at risk, ETA unknown, on time, then delivered (newest
 * first). Within a group, the earliest arrival first. Deliveries older than 30 days drop out.
 * Expects shipments already filtered to the customer by `visibleShipments`.
 */
export function customerShipments(shipments: Shipment[], now: Date): CustomerShipment[] {
  const oldest = now.getTime() - DELIVERED_SHOWN_DAYS * 24 * HOUR_MS;
  return shipments
    .map((shipment) => toCustomerShipment(shipment, now))
    .filter((view) => view.delivery === undefined || Date.parse(view.delivery.at) >= oldest)
    .sort(byUrgency);
}

function toCustomerShipment(shipment: Shipment, now: Date): CustomerShipment {
  const predicted = predictEta(shipment, now);
  const prediction = predicted && predicted.confidence >= REVIEW_BELOW ? predicted : undefined;
  const status = getShipmentStatus(shipment);
  const step = shipment.legs.at(-1)?.milestones.find((m) => m.type === "delivered");
  return {
    shipment,
    status,
    eta: getEtaStatus(shipment, prediction),
    prediction,
    summary: summarizeShipment(shipment, now),
    delivery: status === "delivered" && step?.at ? { at: step.at, source: step.source } : undefined,
  };
}

// Unknown needs more attention than on time, but it isn't a known delay.
const RANK: Record<EtaStatus, number> = { late: 0, at_risk: 1, unknown: 2, on_time: 3 };

function byUrgency(a: CustomerShipment, b: CustomerShipment): number {
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;
  if (a.delivery && b.delivery) return Date.parse(b.delivery.at) - Date.parse(a.delivery.at);
  return arrivalTime(a) - arrivalTime(b);
}

/** The arrival as a number to sort by; an unreadable date sorts last, so the order stays stable. */
function arrivalTime(view: CustomerShipment): number {
  const ms = Date.parse(bestEta(view));
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Delivered shipments come after every active one. */
function rank(view: CustomerShipment): number {
  return view.delivery === undefined ? RANK[view.eta.status] : 4;
}

/** The arrival the customer is shown: the end of a firm AI window, else the operator's ETA. */
function bestEta(view: CustomerShipment): string {
  return view.prediction?.latest ?? view.shipment.operatorEta.date;
}

/** Counts for the summary bar, from the view so they always match the cards. */
export function countByEta(views: CustomerShipment[]): EtaCounts {
  const counts: EtaCounts = { on_time: 0, at_risk: 0, late: 0, unknown: 0, delivered: 0 };
  for (const view of views) {
    if (view.delivery === undefined) counts[view.eta.status] += 1;
    else counts.delivered += 1;
  }
  return counts;
}

/**
 * Proactive delay alerts: only from an AI prediction with High confidence (≥ 0.8) that makes
 * the shipment at risk or late. A less sure prediction becomes an ops exception instead
 * (PRD §6), so it never reaches the customer from here. Newest first.
 */
export function customerAlerts(views: CustomerShipment[]): CustomerAlert[] {
  return views
    .flatMap((view) => {
      const { prediction, shipment, eta } = view;
      if (!prediction || prediction.confidence < HIGH_CONFIDENCE) return [];
      if (eta.source !== "ai_predicted" || !isDelayed(eta.status)) return [];
      // Dated when the step that revealed the delay was reported, not when the page was opened.
      const createdAt = getFurthestStep(shipment)?.milestone.at ?? getLastUpdateAt(shipment);
      if (createdAt === null || createdAt === undefined) return [];
      const alert: CustomerAlert = {
        id: `alert-${shipment.id}-eta`,
        shipmentId: shipment.id,
        severity: "warning",
        message: delayMessage(shipment, prediction),
        createdAt,
        source: "ai_predicted",
        confidence: prediction.confidence,
      };
      return [alert];
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** E.g. "SHP-1042 is likely to arrive about a day late: AI predicts Tue 27 Oct." */
function delayMessage(s: Shipment, p: EtaPrediction): string {
  const hoursLate = (Date.parse(p.latest) - Date.parse(s.plannedEta)) / HOUR_MS;
  const days = Math.round(hoursLate / 24);
  const howLate = hoursLate <= 24 ? "up to a day late" : days === 1 ? "about a day late" : `about ${days} days late`;
  return `${s.id} is likely to arrive ${howLate}: AI predicts ${formatDayRange(p.earliest, p.latest)}.`;
}

/**
 * The factual acknowledgement a customer gets when ops misses the response target on an
 * exception that needs a message to them, and the draft hasn't been approved (PRD §6). No
 * commitments, no cause, no date: only that we know and are on it. Dated at the deadline.
 */
export function escalationAlerts(
  exceptions: ShipmentException[],
  approvedIds: ReadonlySet<string>,
  now: Date,
): CustomerAlert[] {
  return exceptions
    .filter((e) => messagesCustomer(e.suggestedAction) && isOverdue(e, now) && !approvedIds.has(e.id))
    .map((e) => ({
      id: `escalation-${e.id}`,
      shipmentId: e.shipmentId,
      severity: e.severity === "critical" ? "critical" : "warning",
      message: `We're aware of an issue with ${e.shipmentId} and are working on it.`,
      createdAt: e.respondBy,
      source: "confirmed",
    }));
}
