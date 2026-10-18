/**
 * Builds a shipment from its booking (the plan) and the operator events received for it.
 * Pure functions: the same input always gives the same shipment.
 */
import type { Leg, Milestone, NormalizedEvent, RawEventRef, Shipment } from "@/lib/types";

/** Below this confidence, an event is kept for ops to review but doesn't change milestones. */
export const MIN_CONFIDENCE_TO_APPLY = 0.6;

/**
 * Returns the booking with its events applied, oldest first. Every event is kept in
 * `rawEvents` for traceability, except exact repeats of a message already received.
 * Confident events also complete the matching step on the timeline. Events for other
 * shipments are ignored.
 */
export function applyEvents(booking: Shipment, events: NormalizedEvent[]): Shipment {
  const own = events
    .filter((e) => e.shipmentId === booking.id)
    .map((e) => e.event)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  return own.reduce<Shipment>((shipment, event) => {
    if (shipment.rawEvents.some((seen) => isSameMessage(seen, event))) return shipment;
    const confident = event.normalizedTo !== null && event.confidence >= MIN_CONFIDENCE_TO_APPLY;
    return {
      ...shipment,
      rawEvents: [...shipment.rawEvents, event],
      legs: confident ? applyToTimeline(shipment.legs, event) : shipment.legs,
    };
  }, booking);
}

function isSameMessage(a: RawEventRef, b: RawEventRef): boolean {
  return a.operatorId === b.operatorId && a.receivedAt === b.receivedAt && a.original === b.original;
}

/**
 * Puts one event on the timeline, on exactly one leg run by the event's operator, judged
 * from the leg they're on now (their latest leg with a step done, or their next leg once
 * that one is finished):
 * - a step still to happen on that leg is completed;
 * - a step that already happened there ("still in transit") changes nothing;
 * - a step only planned on one of their later legs is completed there (a missed report);
 * - an unplanned step, such as a customs hold, is added to the leg they're on.
 *
 * Feeds don't say which leg they mean, so a late resend of a finished leg's last step can
 * still land on the next leg. Real integrations should carry a leg or booking reference.
 */
function applyToTimeline(legs: Leg[], event: RawEventRef): Leg[] {
  const type = event.normalizedTo;
  if (type === null) return legs;

  const theirs = legs.filter((leg) => leg.operatorId === event.operatorId);
  const inProgress = legInProgress(theirs);
  if (inProgress === undefined) return legs;

  const step: Pick<Milestone, "at" | "source" | "rawStatus"> = {
    at: event.receivedAt,
    source: "confirmed",
    rawStatus: event.original,
  };

  const isOpenStep = (m: Milestone) => m.type === type && m.at === null;

  if (inProgress.milestones.some(isOpenStep)) return completeStep(legs, inProgress, isOpenStep, step);
  if (inProgress.milestones.some((m) => m.type === type)) return legs;

  const later = theirs.slice(theirs.indexOf(inProgress) + 1).find((leg) => leg.milestones.some(isOpenStep));
  if (later) return completeStep(legs, later, isOpenStep, step);

  const added: Milestone = { type, plannedAt: event.receivedAt, ...step };
  const milestones = [...inProgress.milestones, added].sort((a, b) =>
    a.plannedAt.localeCompare(b.plannedAt),
  );
  return replaceLeg(legs, inProgress, { ...inProgress, milestones });
}

/**
 * The leg in progress among `legs`: the latest one with a step done, or the next one once
 * every step on it is done. A skipped report doesn't hold it back on an earlier leg.
 * Before anything has happened it's the first leg; when all are done, the last.
 * `undefined` only when `legs` is empty.
 *
 * Used with one operator's legs (where an event lands) and with all of a shipment's legs
 * (`getCurrentLeg`).
 */
export function legInProgress(legs: Leg[]): Leg | undefined {
  const started = legs.map((leg) => leg.milestones.some((m) => m.at !== null)).lastIndexOf(true);
  const index = Math.max(started, 0);
  const leg = legs[index];
  if (leg === undefined) return undefined;
  const finished = leg.milestones.every((m) => m.at !== null);
  return finished ? (legs[index + 1] ?? leg) : leg;
}

function completeStep(
  legs: Leg[],
  leg: Leg,
  isOpenStep: (m: Milestone) => boolean,
  step: Pick<Milestone, "at" | "source" | "rawStatus">,
): Leg[] {
  const index = leg.milestones.findIndex(isOpenStep);
  const milestones = leg.milestones.map((m, i) => (i === index ? { ...m, ...step } : m));
  return replaceLeg(legs, leg, { ...leg, milestones });
}

function replaceLeg(legs: Leg[], old: Leg, updated: Leg): Leg[] {
  return legs.map((leg) => (leg === old ? updated : leg));
}
