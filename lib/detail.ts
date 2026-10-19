/**
 * The shared shipment detail page (F5): the leg timeline with the state of every step, how each
 * operator message was read, and what ops has done about the shipment's exceptions. Pure, so
 * it's tested without React. Spec: docs/PRD.md §4 (F5), docs/DESIGN.md §6 (Leg timeline).
 */
import { getShipmentStatus } from "@/lib/derived";
import { sentAlertId } from "@/lib/inbox";
import { MIN_CONFIDENCE_TO_APPLY } from "@/lib/shipments";
import type { CustomerAlert, Leg, Location, Milestone, MilestoneType, RawEventRef, Shipment } from "@/lib/types";

/**
 * Where a step stands. `not_reported` is a step the shipment has passed without the operator
 * reporting it: showing it as still to come would be wrong, and as done would invent a time.
 */
export type StepState = "done" | "current" | "upcoming" | "not_reported";

/** One step on the timeline, with where it stands. */
export type TimelineStep = { milestone: Milestone; state: StepState };

/** A block on the timeline: a leg, or the customs steps at the port where a leg ends. */
export type TimelineGroup =
  | { kind: "leg"; leg: Leg; steps: TimelineStep[] }
  | { kind: "customs"; place: Location; steps: TimelineStep[] };

/** A step in plain words. A Record over the union fails to compile if a step is added without words. */
export const STEP_LABELS: Record<MilestoneType, string> = {
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  gate_in: "At the port terminal",
  loaded: "Loaded on the vessel",
  departed: "Departed",
  arrived: "Arrived",
  discharged: "Unloaded from the vessel",
  customs_submitted: "Customs declaration submitted",
  customs_hold: "Held by customs",
  customs_cleared: "Cleared by customs",
};

const CUSTOMS_STEPS: readonly MilestoneType[] = ["customs_submitted", "customs_hold", "customs_cleared"];

/**
 * The timeline: every leg in order with its steps, and customs as its own block after the leg
 * that ends at the customs port (DESIGN §6). Steps the operator reported are `done`. Of the rest,
 * those before the last reported step along the route are `not_reported`, the first one after
 * them is `current`, and the others are `upcoming`. A delivered shipment has no current step.
 *
 * A customs hold counts as reported here: a held shipment has had its declaration submitted,
 * even if nobody said so. But while customs is holding it, the clearance is always `current`,
 * even when it was planned before the hold was reported.
 */
export function timelineGroups(s: Shipment): TimelineGroup[] {
  const held = getShipmentStatus(s) === "customs_hold";
  // Legs in order of travel, each sorted by planned time: the same order as the status uses.
  const all = s.legs.flatMap((leg) => leg.milestones);
  const lastDone = all.findLastIndex((m) => m.at !== null);
  const passed = (m: Milestone, i: number) => i < lastDone && !(held && m.type === "customs_cleared");
  const current = all.find((m, i) => m.at === null && !passed(m, i));

  const stateOf = (m: Milestone): StepState => {
    if (m.at !== null) return "done";
    if (passed(m, all.indexOf(m))) return "not_reported";
    return m === current ? "current" : "upcoming";
  };
  const toSteps = (milestones: Milestone[]) => milestones.map((milestone) => ({ milestone, state: stateOf(milestone) }));

  return s.legs.flatMap((leg): TimelineGroup[] => {
    const onLeg = leg.milestones.filter((m) => !CUSTOMS_STEPS.includes(m.type));
    const customs = leg.milestones.filter((m) => CUSTOMS_STEPS.includes(m.type));
    const groups: TimelineGroup[] = [{ kind: "leg", leg, steps: toSteps(onLeg) }];
    if (customs.length > 0) groups.push({ kind: "customs", place: leg.to, steps: toSteps(customs) });
    return groups;
  });
}

/**
 * How an operator message was read (A1), for ops to check against the original: the step it
 * was read as (`null` when nothing was recognised), whether it changed the timeline, and why.
 */
export type MessageReading = {
  readAs: string | null;
  applied: boolean;
  /** Why the reading did or didn't change the timeline, in plain words. */
  reason: string;
};

/** How one operator message was read. See {@link MessageReading}. */
export function messageReading(event: RawEventRef): MessageReading {
  const readAs = event.normalizedTo === null ? null : STEP_LABELS[event.normalizedTo];
  const applied = readAs !== null && event.confidence >= MIN_CONFIDENCE_TO_APPLY;
  let outcome: string;
  if (readAs === null) outcome = "No shipment step recognised. Kept for review; the timeline is unchanged.";
  else if (!applied) outcome = "Too uncertain to act on. Kept for review; the timeline is unchanged.";
  else if (event.confidence === 1) outcome = "A known status code. Applied to the timeline.";
  else outcome = `${event.readingNote ?? "Matched from the message text."} Applied to the timeline.`;
  // An uncertain or unread email still says which words the reading rests on.
  const reason = !applied && event.readingNote ? `${event.readingNote} ${outcome}` : outcome;
  return { readAs, applied, reason };
}

/** Operator messages newest first, for the ops view. Leaves the shipment untouched. */
export function messagesNewestFirst(s: Shipment): RawEventRef[] {
  return [...s.rawEvents].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
}

/**
 * What ops has done about an exception in this demo session. Only this session: nothing is
 * stored, so a reload starts every exception as `open` again (RATIONALE §2).
 */
export type ExceptionOutcome = "open" | "followed_up" | "resolved" | "customer_notified";

/** An outcome in words. A Record over the union fails to compile if one is added without words. */
export const OUTCOME_LABELS: Record<ExceptionOutcome, string> = {
  open: "Open",
  followed_up: "Handled, not resolved",
  resolved: "Resolved",
  customer_notified: "Customer notified",
};

/** The ops actions recorded in the demo store, as the detail page needs them. */
export type OpsActions = {
  handledIds: readonly string[];
  settledIds: readonly string[];
  sentAlerts: readonly CustomerAlert[];
};

/**
 * What happened to one exception, the most telling first: a message sent to the customer, then
 * resolved, then any other handling (snoozed, operator contacted), else still open.
 */
export function exceptionOutcome(exceptionId: string, actions: OpsActions): ExceptionOutcome {
  if (actions.sentAlerts.some((alert) => alert.id === sentAlertId(exceptionId))) return "customer_notified";
  if (actions.settledIds.includes(exceptionId)) return "resolved";
  if (actions.handledIds.includes(exceptionId)) return "followed_up";
  return "open";
}
