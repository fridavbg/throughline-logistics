/**
 * Small builders for booking plans, so each seed shipment reads as a short list of legs.
 * Times are hours relative to the demo clock: negative is in the past.
 */
import { hoursFromNow } from "@/lib/time";
import type {
  DocumentType,
  Leg,
  Location,
  Milestone,
  MilestoneType,
  ShipmentDocument,
} from "@/lib/types";

/** A step that hasn't been reported yet, planned for `hours` from now. */
function planned(type: MilestoneType, hours: number): Milestone {
  return { type, at: null, plannedAt: hoursFromNow(hours), source: "estimated" };
}

/** A road leg: picked up, in transit, delivered. */
export function roadLeg(
  sequence: number,
  operatorId: string,
  from: Location,
  to: Location,
  [pickedUp, inTransit, delivered]: [number, number, number],
): Leg {
  return {
    sequence,
    mode: "road",
    operatorId,
    from,
    to,
    milestones: [
      planned("picked_up", pickedUp),
      planned("in_transit", inTransit),
      planned("delivered", delivered),
    ],
  };
}

/**
 * A sea leg with Saltwren Lines: gate in, loaded, departed, arrived, discharged. Shipments
 * leaving the EU add customs at the arrival port, after discharge.
 */
export function seaLeg(
  sequence: number,
  from: Location,
  to: Location,
  [gateIn, loaded, departed, arrived, discharged]: [number, number, number, number, number],
  customs?: { submitted: number; cleared: number },
): Leg {
  const milestones = [
    planned("gate_in", gateIn),
    planned("loaded", loaded),
    planned("departed", departed),
    planned("arrived", arrived),
    planned("discharged", discharged),
  ];
  if (customs) {
    milestones.push(
      planned("customs_submitted", customs.submitted),
      planned("customs_cleared", customs.cleared),
    );
  }
  return { sequence, mode: "sea", operatorId: "op-saltwren", from, to, milestones };
}

/** The shipment's paperwork; every listed document is required. */
export function documents(
  types: DocumentType[],
  missing: DocumentType[] = [],
): ShipmentDocument[] {
  return types.map((type) => ({
    type,
    status: missing.includes(type) ? "missing" : "available",
    required: true,
  }));
}

/** Paperwork for each kind of route. */
export const DOMESTIC_ROAD: DocumentType[] = ["commercial_invoice", "cmr"];
export const EU_ROAD: DocumentType[] = ["commercial_invoice", "packing_list", "cmr"];
export const EU_SEA: DocumentType[] = ["commercial_invoice", "packing_list", "bill_of_lading", "cmr"];
export const NON_EU_SEA: DocumentType[] = [...EU_SEA, "customs_declaration"];
