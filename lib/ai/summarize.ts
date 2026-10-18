/**
 * Simulated AI shipment summary (A5). A template turns status, current leg and ETA into one
 * plain sentence for the customer: where it is, whether it's on time, what happens next.
 * Deterministic. Predictions are worded as predictions and operator estimates as estimates,
 * so the sentence never states more than the data knows. Spec: docs/DATA_MODEL.md §5.
 */
import { REVIEW_BELOW } from "@/lib/ai/confidence";
import { predictEta } from "@/lib/ai/eta";
import {
  getCurrentLeg,
  getEtaStatus,
  getFurthestStep,
  getLastUpdateAt,
  getShipmentStatus,
  isStale,
} from "@/lib/derived";
import { formatDay, HOUR_MS } from "@/lib/time";
import type { EtaPrediction, EtaStatus, Leg, Milestone, Shipment, ShipmentSummary } from "@/lib/types";

/** Confidence when the sentence only repeats operator data: it reports, it doesn't guess. */
export const FACTS_CONFIDENCE = 0.95;

/**
 * The customer's summary of a shipment, e.g. "At sea from Port of Valencia to Port of
 * Southampton, expected Fri 23 Oct (operator estimate), on time; next: arrival at Port of
 * Southampton."
 *
 * Its confidence is the AI prediction's when there is one, since a prediction exists exactly
 * when something is uncertain (a delay, or a quiet operator); otherwise {@link FACTS_CONFIDENCE}.
 */
export function summarizeShipment(s: Shipment, now: Date): ShipmentSummary {
  const prediction = predictEta(s, now);
  // Below the review line a prediction is too unsure to state; the operator's ETA is used.
  const trusted = prediction && prediction.confidence >= REVIEW_BELOW ? prediction : undefined;
  return {
    text: `${sentence(s, now, trusted)}.`,
    confidence: Math.min(FACTS_CONFIDENCE, prediction?.confidence ?? FACTS_CONFIDENCE),
    reason: `${basis(s, trusted)}; ${freshness(s, now)}`,
  };
}

function sentence(s: Shipment, now: Date, trusted: EtaPrediction | undefined): string {
  const status = getShipmentStatus(s);
  switch (status) {
    case "delivered":
      return delivered(s);
    case "customs_hold":
      return `Held by customs at ${holdPlace(s)}; the arrival date depends on when it's released`;
    case "planned":
      return `Booked for pickup at ${s.legs[0]?.from.name ?? "origin"}, ${arrival(s, trusted)}`;
    case "in_transit":
    case "at_port": {
      const stale = isStale(s, now);
      const quiet = stale ? `, but the operator hasn't sent an update for ${hoursSinceUpdate(s, now)}h` : "";
      // A quiet operator makes the summary "Needs review", so it gives no firm on-time answer,
      // unless a known delay (a fact) is behind the prediction.
      const firm = !stale || trusted !== undefined;
      const step = nextStep(s);
      const next = step ? `; next: ${upcoming(step.milestone, step.leg, s)}` : "";
      return `${where(s, status)}, ${arrival(s, trusted, firm)}${quiet}${next}`;
    }
    default: {
      // Adding a status without a sentence here fails to compile.
      const unhandled: never = status;
      throw new Error(`Unhandled status: ${String(unhandled)}`);
    }
  }
}

/** Where a moving shipment is: on its current leg, or at the port of its latest step. */
function where(s: Shipment, status: "in_transit" | "at_port"): string {
  const step = getFurthestStep(s);
  if (status === "at_port" && step) return `At ${placeOf(step.milestone, step.leg)}`;
  const leg = getCurrentLeg(s);
  if (!leg) return "On its way";
  const how = leg.mode === "sea" ? "At sea" : "On the road";
  return `${how} from ${leg.from.name} to ${leg.to.name}`;
}

/** When it arrives, worded by who says so, and when `firm`, whether that's on time. */
function arrival(s: Shipment, trusted: EtaPrediction | undefined, firm = true): string {
  const lateness = firm ? `, ${latenessWords(getEtaStatus(s, trusted).status)}` : "";
  if (trusted) return `AI predicts arrival ${dayRange(trusted.earliest, trusted.latest)}${lateness}`;
  const day = formatDay(s.operatorEta.date);
  return s.operatorEta.source === "confirmed"
    ? `arriving ${day}${lateness}`
    : `expected ${day} (operator estimate)${lateness}`;
}

function latenessWords(status: EtaStatus): string {
  switch (status) {
    case "on_time":
      return "on time";
    case "at_risk":
      return "up to a day late";
    case "late":
      return "more than a day late";
    default: {
      const unhandled: never = status;
      throw new Error(`Unhandled ETA status: ${String(unhandled)}`);
    }
  }
}

function delivered(s: Shipment): string {
  const last = s.legs.at(-1);
  const step = last?.milestones.find((m) => m.type === "delivered");
  if (!last || !step?.at) return "Delivered";
  const verb = step.source === "confirmed" ? "Delivered" : "Reported delivered";
  return `${verb} to ${last.to.name} on ${formatDay(step.at)}`;
}

/** Customs steps happen at the leg's arrival port. */
function holdPlace(s: Shipment): string {
  const leg = s.legs.find((l) => l.milestones.some((m) => m.type === "customs_hold" && m.at !== null));
  return leg?.to.name ?? "the border";
}

/** The first step not done yet after the furthest one, skipping customs holds (never planned). */
function nextStep(s: Shipment): { milestone: Milestone; leg: Leg } | undefined {
  const steps = s.legs.flatMap((leg) => leg.milestones.map((milestone) => ({ milestone, leg })));
  const furthest = getFurthestStep(s)?.milestone;
  const from = steps.findIndex((step) => step.milestone === furthest) + 1; // 0 when nothing is done
  return steps.slice(from).find((step) => step.milestone.at === null && step.milestone.type !== "customs_hold");
}

/** Where a step happens: steps before departure at the leg's start, the rest at its end. */
function placeOf(m: Milestone, leg: Leg): string {
  const atStart = m.type === "picked_up" || m.type === "in_transit" || m.type === "gate_in" || m.type === "loaded" || m.type === "departed";
  return atStart ? leg.from.name : leg.to.name;
}

/** An upcoming step in customer words, e.g. "arrival at Port of Southampton". */
function upcoming(m: Milestone, leg: Leg, s: Shipment): string {
  const place = placeOf(m, leg);
  switch (m.type) {
    case "picked_up":
      return `pickup at ${place}`;
    case "in_transit":
      return `departure by road from ${place}`;
    case "gate_in":
      return `gate-in at ${place}`;
    case "loaded":
      return `loading at ${place}`;
    case "departed":
      return `departure from ${place}`;
    case "arrived":
      return `arrival at ${place}`;
    case "discharged":
      return `unloading at ${place}`;
    case "customs_submitted":
      return `customs entry at ${place}`;
    case "customs_hold":
    case "customs_cleared":
      return `customs clearance at ${place}`;
    case "delivered":
      return leg === s.legs.at(-1) ? `delivery to ${place}` : `drop-off at ${place}`;
    default: {
      const unhandled: never = m.type;
      throw new Error(`Unhandled milestone type: ${String(unhandled)}`);
    }
  }
}

/** What the sentence rests on: the AI prediction's reason, or whose ETA it repeats. */
function basis(s: Shipment, trusted: EtaPrediction | undefined): string {
  if (trusted) return `AI prediction: ${trusted.reason}`;
  const status = getShipmentStatus(s);
  if (status === "delivered") return "Delivery reported by the operator";
  if (status === "customs_hold") return "Customs hold reported by the operator, no release time yet";
  return s.operatorEta.source === "confirmed" ? "Operator's confirmed ETA" : "Operator estimate";
}

function freshness(s: Shipment, now: Date): string {
  if (getLastUpdateAt(s) === null) return "no operator update yet";
  const hours = hoursSinceUpdate(s, now);
  return hours < 1 ? "last update less than an hour ago" : `last update ${hours}h ago`;
}

/** Hours since the operator last reported, rounded like the ETA reason; 0 before the first report. */
function hoursSinceUpdate(s: Shipment, now: Date): number {
  const last = getLastUpdateAt(s);
  return last === null ? 0 : Math.round((now.getTime() - Date.parse(last)) / HOUR_MS);
}

/** "Fri 23 Oct", or "Fri 23 Oct – Sat 24 Oct" when the window spans days. */
function dayRange(earliest: string, latest: string): string {
  const [from, to] = [formatDay(earliest), formatDay(latest)];
  return from === to ? from : `${from} – ${to}`;
}
