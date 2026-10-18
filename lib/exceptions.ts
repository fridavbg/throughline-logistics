/**
 * Exception detection (A3) with a suggested next action (A4): what on a shipment needs an
 * ops user's attention, how soon, and what to do about it. Rule-based and deterministic;
 * `rankExceptions` in lib/ai/triage.ts scores and orders the result. Spec: docs/PRD.md §4 (F2).
 */
import { HIGH_CONFIDENCE } from "@/lib/ai/confidence";
import { predictEta } from "@/lib/ai/eta";
import { FACTS_CONFIDENCE } from "@/lib/ai/summarize";
import { getEtaStatus, getFurthestStep, getLastUpdateAt, getShipmentStatus, isStale, STALE_AFTER_HOURS } from "@/lib/derived";
import { MIN_CONFIDENCE_TO_APPLY } from "@/lib/shipments";
import { HOUR_MS } from "@/lib/time";
import type { DetectedException, DocumentType, ExceptionType, NextAction, Severity, Shipment } from "@/lib/types";

/** How long ops has to respond, in minutes, from when the problem was detected. */
export const RESPONSE_MINUTES: Record<Severity, number> = { critical: 30, warning: 120 };

/** Customs holds and incidents are critical; everything else is a warning. */
export function severityOf(type: ExceptionType): Severity {
  switch (type) {
    case "customs_hold":
    case "incident":
      return "critical";
    case "delay":
    case "stale":
    case "missing_document":
    case "needs_review":
      return "warning";
    default: {
      // Adding an exception type without a severity here fails to compile.
      const unhandled: never = type;
      throw new Error(`Unhandled exception type: ${String(unhandled)}`);
    }
  }
}

/** A document in plain words, e.g. "packing list". */
export const DOCUMENT_NAMES: Record<DocumentType, string> = {
  commercial_invoice: "commercial invoice",
  packing_list: "packing list",
  bill_of_lading: "bill of lading",
  customs_declaration: "customs declaration",
  cmr: "CMR (road consignment note)",
};

/**
 * Everything on a shipment that needs attention now. `incident` is never detected: nothing in
 * the data reports one yet, and a signal isn't invented here.
 */
export function detectExceptions(s: Shipment, now: Date): DetectedException[] {
  const found = [customsHold(s), missingDocument(s, now), stale(s, now), delay(s, now), needsReview(s)];
  return found.filter((e): e is DetectedException => e !== undefined);
}

type Finding = Pick<DetectedException, "type" | "detectedAt" | "impact" | "suggestedAction" | "actionReason" | "confidence">;

function exception(s: Shipment, finding: Finding): DetectedException {
  const severity = severityOf(finding.type);
  const respondBy = new Date(Date.parse(finding.detectedAt) + RESPONSE_MINUTES[severity] * 60_000).toISOString();
  return { id: `${s.id}-${finding.type}`, shipmentId: s.id, severity, respondBy, ...finding };
}

/** Required documents not on file, in plain words. */
function missingDocs(s: Shipment): string[] {
  return s.documents.filter((d) => d.required && d.status === "missing").map((d) => DOCUMENT_NAMES[d.type]);
}

/** A hold, detected when the operator reported it. A missing document is folded in: one problem, one row. */
function customsHold(s: Shipment): DetectedException | undefined {
  if (getShipmentStatus(s) !== "customs_hold") return undefined;
  const holds = s.legs.flatMap((l) => l.milestones).filter((m) => m.type === "customs_hold" && m.at !== null);
  const detectedAt = holds.map((m) => m.at ?? "").sort().at(-1);
  if (!detectedAt) return undefined;
  const missing = missingDocs(s);
  const action: Pick<Finding, "suggestedAction" | "actionReason"> = missing.length
    ? { suggestedAction: "request_document", actionReason: `Customs needs the ${missing.join(" and ")}` }
    : { suggestedAction: "contact_operator", actionReason: "Ask the operator what customs needs to release it" };
  return exception(s, { type: "customs_hold", detectedAt, impact: "Arrival on hold until customs releases it", confidence: FACTS_CONFIDENCE, ...action });
}

/**
 * Required paperwork missing on a shipment that isn't held (a hold already asks for it) or
 * delivered. Documents carry no timestamp, so the gap counts from when it's checked.
 */
function missingDocument(s: Shipment, now: Date): DetectedException | undefined {
  const status = getShipmentStatus(s);
  const missing = missingDocs(s);
  if (missing.length === 0 || status === "customs_hold" || status === "delivered") return undefined;
  return exception(s, {
    type: "missing_document",
    detectedAt: now.toISOString(),
    impact: `Missing ${missing.join(", ")}`,
    suggestedAction: "request_document",
    actionReason: `The ${missing.join(" and ")} must be on file before it's needed`,
    confidence: FACTS_CONFIDENCE,
  });
}

/** Quiet for more than 24h while moving: detected the moment the 24h ran out. */
function stale(s: Shipment, now: Date): DetectedException | undefined {
  const last = getLastUpdateAt(s);
  if (last === null || !isStale(s, now)) return undefined;
  const hours = Math.round((now.getTime() - Date.parse(last)) / HOUR_MS);
  return exception(s, {
    type: "stale",
    detectedAt: new Date(Date.parse(last) + STALE_AFTER_HOURS * HOUR_MS).toISOString(),
    impact: `No update for ${hours}h`,
    suggestedAction: "contact_operator",
    actionReason: "Ask the operator for a position update",
    confidence: FACTS_CONFIDENCE,
  });
}

/**
 * Arriving after the promise, by the AI's prediction or the operator's ETA. A hold has its
 * own exception. Who should act depends on whether the customer has already been told: a
 * High-confidence prediction alerts them automatically (PRD §6), anything else needs ops.
 */
function delay(s: Shipment, now: Date): DetectedException | undefined {
  const status = getShipmentStatus(s);
  if (status === "delivered" || status === "customs_hold") return undefined;
  const prediction = predictEta(s, now);
  const eta = getEtaStatus(s, prediction);
  if (eta.status === "on_time") return undefined;

  if (eta.source === "ai_predicted" && prediction) {
    const detectedAt = getFurthestStep(s)?.milestone.at ?? getLastUpdateAt(s);
    if (!detectedAt) return undefined;
    const alerted = prediction.confidence >= HIGH_CONFIDENCE;
    return exception(s, {
      type: "delay",
      detectedAt,
      impact: delayImpact(s.plannedEta, prediction.latest),
      ...nextStepForDelay(alerted),
      confidence: prediction.confidence,
    });
  }
  return exception(s, {
    type: "delay",
    detectedAt: getLastUpdateAt(s) ?? now.toISOString(),
    impact: delayImpact(s.plannedEta, s.operatorEta.date),
    suggestedAction: "notify_customer",
    actionReason: "The operator's ETA is past the promised arrival",
    confidence: FACTS_CONFIDENCE,
  });
}

function nextStepForDelay(customerAlerted: boolean): { suggestedAction: NextAction; actionReason: string } {
  return customerAlerted
    ? { suggestedAction: "contact_operator", actionReason: "The customer was alerted automatically; ask the operator how to recover the time" }
    : { suggestedAction: "notify_customer", actionReason: "The prediction is below High confidence, so the customer hasn't been told" };
}

/** "ETA +26h", or "ETA +3 days" from two days late. */
function delayImpact(promised: string, expected: string): string {
  const hours = (Date.parse(expected) - Date.parse(promised)) / HOUR_MS;
  return hours < 48 ? `ETA +${Math.round(hours)}h` : `ETA +${Math.round(hours / 24)} days`;
}

/** The operator's latest message couldn't be read with confidence, so it hasn't moved the timeline. */
function needsReview(s: Shipment): DetectedException | undefined {
  const latest = [...s.rawEvents].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt)).at(-1);
  if (!latest) return undefined;
  const unclear = latest.normalizedTo === null || latest.confidence < MIN_CONFIDENCE_TO_APPLY;
  if (!unclear) return undefined;
  const impact = latest.normalizedTo === null
    ? "Operator update we couldn't read"
    : `Operator update read with ${Math.round(latest.confidence * 100)}% confidence`;
  return exception(s, {
    type: "needs_review",
    detectedAt: latest.receivedAt,
    impact,
    suggestedAction: "review_update",
    actionReason: "Check the original message before it changes the timeline",
    confidence: FACTS_CONFIDENCE,
  });
}
