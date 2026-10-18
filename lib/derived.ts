/**
 * Values worked out from a shipment instead of stored on it: status, current leg, last
 * update, staleness and lateness. Because they are computed every time, a simulated event
 * can never leave them out of date. Spec: docs/DATA_MODEL.md §5.
 */
import { REVIEW_BELOW } from "@/lib/ai/confidence";
import { legInProgress } from "@/lib/shipments";
import { HOUR_MS } from "@/lib/time";
import type {
  EtaPrediction,
  EtaStatus,
  EtaStatusWithSource,
  Leg,
  Milestone,
  MilestoneType,
  Shipment,
  ShipmentException,
  ShipmentStatus,
} from "@/lib/types";

/** With no operator update for longer than this, a moving shipment is stale. */
export const STALE_AFTER_HOURS = 24;

/** Up to this many hours past the promised arrival, a shipment is at risk; beyond it, late. */
export const LATE_AFTER_HOURS = 24;

/** A step that has happened, with the position of its leg in the order of travel. */
type DoneStep = { milestone: Milestone; at: number; legIndex: number };

/** Every step that has happened, in the order the shipment's legs list them. */
function doneSteps(s: Shipment): DoneStep[] {
  return s.legs.flatMap((leg, legIndex) =>
    leg.milestones.flatMap((milestone) =>
      milestone.at === null ? [] : [{ milestone, at: Date.parse(milestone.at), legIndex }],
    ),
  );
}

/** Orders steps along the route: by leg, then by planned time within the leg. */
function byTravelOrder(a: DoneStep, b: DoneStep): number {
  return a.legIndex - b.legIndex || Date.parse(a.milestone.plannedAt) - Date.parse(b.milestone.plannedAt);
}

/**
 * Whether customs is holding the shipment: its latest hold has no `customs_cleared` at the
 * same time or after it. Decided by when steps happened, since a hold can come and go.
 */
function hasUnresolvedHold(steps: DoneStep[]): boolean {
  const holds = steps.filter((step) => step.milestone.type === "customs_hold").map((step) => step.at);
  if (holds.length === 0) return false;
  const clearances = steps.filter((step) => step.milestone.type === "customs_cleared").map((step) => step.at);
  const lastHold = Math.max(...holds);
  return !clearances.some((at) => at >= lastHold);
}

/**
 * Where the shipment is now. An unresolved customs hold wins over everything else.
 * Otherwise it's the furthest step along the route that has happened, not the one reported
 * last: `at` is when we received the report, so an operator sending a missed step late
 * would otherwise move a delivered shipment back to the port. A shipment with no step done
 * yet is `planned`.
 */
export function getShipmentStatus(s: Shipment): ShipmentStatus {
  if (hasUnresolvedHold(doneSteps(s))) return "customs_hold";

  const furthest = getFurthestStep(s);
  if (furthest === undefined) return "planned";

  const onLastLeg = furthest.leg === s.legs.at(-1);
  return statusAfter(furthest.milestone.type, onLastLeg);
}

/**
 * The step furthest along the route that has happened, with its leg, or `undefined` before
 * the first one. A customs hold never counts: it says nothing about where the shipment is.
 */
export function getFurthestStep(s: Shipment): { milestone: Milestone; leg: Leg } | undefined {
  const furthest = doneSteps(s)
    .filter((step) => step.milestone.type !== "customs_hold")
    .sort(byTravelOrder)
    .at(-1);
  const leg = furthest && s.legs[furthest.legIndex];
  return furthest && leg ? { milestone: furthest.milestone, leg } : undefined;
}

/**
 * The status a shipment has right after a step. `delivered` ends the shipment only on its
 * last leg: on an earlier leg it means the truck handed the cargo over at the port.
 */
function statusAfter(type: MilestoneType, onLastLeg: boolean): ShipmentStatus {
  switch (type) {
    case "picked_up":
    case "in_transit":
    case "departed":
      return "in_transit";
    case "gate_in":
    case "loaded":
    case "arrived":
    case "discharged":
    case "customs_submitted":
    case "customs_cleared":
      return "at_port";
    case "customs_hold":
      return "customs_hold";
    case "delivered":
      return onLastLeg ? "delivered" : "at_port";
    default: {
      // Adding a milestone type without handling it here fails to compile.
      const unhandled: never = type;
      throw new Error(`Unhandled milestone type: ${String(unhandled)}`);
    }
  }
}

/**
 * The leg the shipment is on: the latest leg with a step done, or the next one once every
 * step on it is done. A skipped operator report doesn't hold it back on an earlier leg.
 * Before departure it's the first leg; once delivered, the last. `undefined` only for a
 * shipment without legs.
 */
export function getCurrentLeg(s: Shipment): Leg | undefined {
  return legInProgress(s.legs);
}

/**
 * When the operator last reported: the newest `rawEvents[].receivedAt`, including messages
 * we couldn't read, since those are still a sign of life. `null` before the first report.
 */
export function getLastUpdateAt(s: Shipment): string | null {
  let newest: string | null = null;
  for (const event of s.rawEvents) {
    if (newest === null || Date.parse(event.receivedAt) > Date.parse(newest)) newest = event.receivedAt;
  }
  return newest;
}

/**
 * Whether a shipment on the move (`in_transit` or `at_port`) has had no operator update for
 * more than 24 hours. Exactly 24 hours is not yet stale. A shipment that hasn't reported at
 * all is never stale: it can only be moving once an operator has reported.
 */
export function isStale(s: Shipment, now: Date): boolean {
  const status = getShipmentStatus(s);
  if (status !== "in_transit" && status !== "at_port") return false;
  const lastUpdate = getLastUpdateAt(s);
  if (lastUpdate === null) return false;
  return now.getTime() - Date.parse(lastUpdate) > STALE_AFTER_HOURS * HOUR_MS;
}

/**
 * Whether the shipment will arrive when promised, and whose ETA says so. Uses the end of the
 * AI's predicted window when its confidence is at least 0.6 (the same line below which the UI
 * shows "Needs review"), otherwise the operator's ETA. Compared with the promised arrival: not after it is `on_time`, up to 24 hours after is
 * `at_risk`, more is `late`.
 *
 * The prediction is optional: without one, the operator's ETA decides.
 *
 * `unknown` when there is no firm answer: during a customs hold, since the release time is
 * unknown; when either date can't be read; and when a stale shipment would be `on_time` by the
 * operator's ETA alone. An operator who has gone quiet can't confirm that it's on time, but a
 * delay they reported still stands. A firm prediction on a stale shipment comes from a delay
 * that has happened, so it still counts.
 */
export function getEtaStatus(s: Shipment, now: Date, prediction?: EtaPrediction): EtaStatusWithSource {
  const usePrediction = prediction !== undefined && prediction.confidence >= REVIEW_BELOW;
  const best = usePrediction
    ? { date: prediction.latest, source: prediction.source }
    : s.operatorEta;
  if (getShipmentStatus(s) === "customs_hold") return { status: "unknown", source: best.source };

  const hoursAfterPromise = (Date.parse(best.date) - Date.parse(s.plannedEta)) / HOUR_MS;
  // An unreadable date gives NaN, which fails every comparison below.
  if (Number.isNaN(hoursAfterPromise)) return { status: "unknown", source: best.source };
  const status =
    hoursAfterPromise <= 0 ? "on_time" : hoursAfterPromise <= LATE_AFTER_HOURS ? "at_risk" : "late";
  if (status === "on_time" && !usePrediction && isStale(s, now)) return { status: "unknown", source: best.source };
  return { status, source: best.source };
}

/**
 * Whether an ETA status is a delay to report. `unknown` isn't one: there is no firm answer,
 * so neither an ops delay exception nor a customer alert may come from it.
 */
export function isDelayed(status: EtaStatus): boolean {
  switch (status) {
    case "at_risk":
    case "late":
      return true;
    case "on_time":
    case "unknown":
      return false;
    default: {
      // Adding an ETA status without deciding here whether it's a delay fails to compile.
      const unhandled: never = status;
      throw new Error(`Unhandled ETA status: ${String(unhandled)}`);
    }
  }
}

/**
 * Whether an exception's response deadline has passed. Exactly at the deadline is not overdue.
 * Takes only `respondBy`, so it works before triage has scored the exception too.
 */
export function isOverdue(e: Pick<ShipmentException, "respondBy">, now: Date): boolean {
  return now.getTime() > Date.parse(e.respondBy);
}
