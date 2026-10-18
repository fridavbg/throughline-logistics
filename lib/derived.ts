/**
 * Values worked out from a shipment instead of stored on it: status, current leg, last
 * update, staleness and lateness. Because they are computed every time, a simulated event
 * can never leave them out of date. Spec: docs/DATA_MODEL.md §5.
 */
import { legInProgress } from "@/lib/shipments";
import { HOUR_MS } from "@/lib/time";
import type {
  EtaPrediction,
  EtaStatusWithSource,
  Leg,
  Milestone,
  MilestoneType,
  Shipment,
  ShipmentException,
  ShipmentStatus,
} from "@/lib/types";

/** Below this confidence, an ETA prediction isn't trusted to decide lateness. */
export const MIN_PREDICTION_CONFIDENCE = 0.6;

/** With no operator update for longer than this, a moving shipment is stale. */
export const STALE_AFTER_HOURS = 24;

/** Up to this many hours past the promised arrival, a shipment is at risk; beyond it, late. */
export const LATE_AFTER_HOURS = 24;

/** A step that has happened, with the position of its leg in the order of travel. */
type DoneStep = { milestone: Milestone; at: number; legIndex: number };

/**
 * Every step that has happened, oldest first by when it happened (`at`), so an operator
 * reporting late or out of order doesn't change the result. Steps at the same moment are
 * ordered by leg, then by planned time.
 */
function doneSteps(s: Shipment): DoneStep[] {
  const steps = s.legs.flatMap((leg, legIndex) =>
    leg.milestones.flatMap((milestone) =>
      milestone.at === null ? [] : [{ milestone, at: Date.parse(milestone.at), legIndex }],
    ),
  );
  return steps.sort(
    (a, b) =>
      a.at - b.at ||
      a.legIndex - b.legIndex ||
      Date.parse(a.milestone.plannedAt) - Date.parse(b.milestone.plannedAt),
  );
}

/**
 * Where the shipment is now, from its latest step that has happened. An unresolved customs
 * hold (no `customs_cleared` after it) wins over any later step. A shipment with no step
 * done yet is `planned`.
 */
export function getShipmentStatus(s: Shipment): ShipmentStatus {
  const steps = doneSteps(s);
  const latest = steps.at(-1);
  if (latest === undefined) return "planned";

  const lastHold = steps.findLastIndex((step) => step.milestone.type === "customs_hold");
  const lastClearance = steps.findLastIndex((step) => step.milestone.type === "customs_cleared");
  if (lastHold > lastClearance) return "customs_hold";

  const onLastLeg = latest.legIndex === s.legs.length - 1;
  return statusAfter(latest.milestone.type, onLastLeg);
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
 * AI's predicted window when its confidence is at least 0.6, otherwise the operator's ETA.
 * Compared with the promised arrival: not after it is `on_time`, up to 24 hours after is
 * `at_risk`, more is `late`.
 *
 * The prediction is optional: without one, the operator's ETA decides.
 */
export function getEtaStatus(s: Shipment, prediction?: EtaPrediction): EtaStatusWithSource {
  const usePrediction = prediction !== undefined && prediction.confidence >= MIN_PREDICTION_CONFIDENCE;
  const best = usePrediction
    ? { date: prediction.latest, source: prediction.source }
    : s.operatorEta;

  const hoursAfterPromise = (Date.parse(best.date) - Date.parse(s.plannedEta)) / HOUR_MS;
  const status =
    hoursAfterPromise <= 0 ? "on_time" : hoursAfterPromise <= LATE_AFTER_HOURS ? "at_risk" : "late";
  return { status, source: best.source };
}

/** Whether an exception's response deadline has passed. Exactly at the deadline is not overdue. */
export function isOverdue(e: ShipmentException, now: Date): boolean {
  return now.getTime() > Date.parse(e.respondBy);
}
