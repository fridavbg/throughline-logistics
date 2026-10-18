/**
 * Simulated AI ETA prediction (A2). Rule-based: a delay on the latest step is carried through
 * to the arrival, before the operator updates its own ETA. Deterministic: the same shipment
 * and time always give the same prediction. Spec: docs/DATA_MODEL.md §5, docs/RATIONALE.md §1.
 *
 * The numbers below are starting values, to be tuned against real lane data.
 */
import { getFurthestStep, getLastUpdateAt, getShipmentStatus, isStale } from "@/lib/derived";
import { HOUR_MS } from "@/lib/time";
import type { EtaPrediction, Leg, Milestone, Shipment } from "@/lib/types";

/** A step less than this many hours late counts as on time: too small to predict from. */
export const MIN_DELAY_HOURS = 1;

/** Share of a known delay that can still be made up, e.g. by a faster crossing. */
export const RECOVERABLE_SHARE = 0.25;

/** Confidence for a delay carried through from a step that has happened. */
export const DELAY_CONFIDENCE = 0.85;

/** Less confident while customs is still ahead: clearance can add its own delay. */
export const CUSTOMS_AHEAD_PENALTY = 0.1;

/** Much less confident when the operator has gone quiet: the last step may be out of date. */
export const STALE_PENALTY = 0.3;

/** A stale shipment with no known delay: low enough that the UI shows "Needs review". */
export const STALE_CONFIDENCE = 0.5;

/**
 * The AI's arrival window for a shipment, or `undefined` when it has nothing to add:
 * - planned or delivered, or held by customs (the hold is an ops exception, and when it's
 *   released is unknown);
 * - no known delay and not stale;
 * - the operator's ETA already allows for the delay.
 *
 * Never changes the shipment or its operator ETA.
 */
export function predictEta(s: Shipment, now: Date): EtaPrediction | undefined {
  const status = getShipmentStatus(s);
  if (status === "planned" || status === "delivered" || status === "customs_hold") return undefined;

  const step = getFurthestStep(s);
  if (step === undefined) return undefined;

  const stale = isStale(s, now);
  const delayHours = hoursLate(step.milestone);
  if (delayHours >= MIN_DELAY_HOURS) return delayPrediction(s, step, delayHours, stale);
  if (stale) return stalePrediction(s, now);
  return undefined;
}

/** How many hours after its planned time a step happened. Negative when early. */
function hoursLate(milestone: Milestone): number {
  if (milestone.at === null) return 0;
  return (Date.parse(milestone.at) - Date.parse(milestone.plannedAt)) / HOUR_MS;
}

/**
 * The promised arrival moved by the delay. The window assumes some of it is made up, but no
 * new delay: widening it later would make shipments look late from uncertainty alone, since
 * the end of the window decides lateness.
 */
function delayPrediction(
  s: Shipment,
  step: { milestone: Milestone; leg: Leg },
  delayHours: number,
  stale: boolean,
): EtaPrediction | undefined {
  const latest = addHours(s.plannedEta, delayHours);
  if (Date.parse(s.operatorEta.date) >= Date.parse(latest)) return undefined;

  let confidence = DELAY_CONFIDENCE;
  if (customsAhead(s)) confidence -= CUSTOMS_AHEAD_PENALTY;
  if (stale) confidence -= STALE_PENALTY;

  return {
    earliest: addHours(s.plannedEta, delayHours * (1 - RECOVERABLE_SHARE)),
    latest,
    confidence: round2(confidence),
    reason: delayReason(step.milestone, step.leg, delayHours),
    source: "ai_predicted",
  };
}

/** No known delay, but no news either: it could be as late as the silence has lasted. */
function stalePrediction(s: Shipment, now: Date): EtaPrediction | undefined {
  const lastUpdate = getLastUpdateAt(s);
  if (lastUpdate === null) return undefined;
  const silentHours = (now.getTime() - Date.parse(lastUpdate)) / HOUR_MS;
  return {
    earliest: s.plannedEta,
    latest: addHours(s.plannedEta, silentHours),
    confidence: STALE_CONFIDENCE,
    reason: `No operator update for ${Math.round(silentHours)}h`,
    source: "ai_predicted",
  };
}

/** Whether the shipment must still clear customs. */
function customsAhead(s: Shipment): boolean {
  if (!s.requiresCustoms) return false;
  const cleared = s.legs.some((leg) =>
    leg.milestones.some((m) => m.type === "customs_cleared" && m.at !== null),
  );
  return !cleared;
}

/** The main reason in plain words, e.g. "Vessel departed 26h late from Port of Valencia". */
function delayReason(milestone: Milestone, leg: Leg, delayHours: number): string {
  const late = `${Math.round(delayHours)}h late`;
  switch (milestone.type) {
    case "picked_up":
      return `Picked up ${late} at ${leg.from.name}`;
    case "in_transit":
      return `Truck set off ${late} from ${leg.from.name}`;
    case "gate_in":
      return `Gated in ${late} at ${leg.from.name}`;
    case "loaded":
      return `Loaded ${late} at ${leg.from.name}`;
    case "departed":
      return `Vessel departed ${late} from ${leg.from.name}`;
    case "arrived":
      return `Vessel arrived ${late} at ${leg.to.name}`;
    case "discharged":
      return `Discharged ${late} at ${leg.to.name}`;
    case "customs_submitted":
      return `Customs entry submitted ${late} at ${leg.to.name}`;
    case "customs_hold":
      return `Held by customs at ${leg.to.name}`;
    case "customs_cleared":
      return `Cleared customs ${late} at ${leg.to.name}`;
    case "delivered":
      return `Delivered ${late} to ${leg.to.name}`;
    default: {
      // Adding a milestone type without a reason here fails to compile.
      const unhandled: never = milestone.type;
      throw new Error(`Unhandled milestone type: ${String(unhandled)}`);
    }
  }
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * HOUR_MS).toISOString();
}

/** Two decimals, so 0.85 − 0.1 shows as 0.75, not 0.7499999999999999. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
