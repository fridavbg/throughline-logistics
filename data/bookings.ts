/**
 * The booked plan for each seed shipment, before any operator update: legs, planned times,
 * promised arrival and paperwork. Operator events (data/raw) are applied on top of this.
 * Each shipment demonstrates one scenario from docs/DATA_MODEL.md §7.
 */
import { hoursFromNow } from "@/lib/time";
import type { Shipment } from "@/lib/types";
import { places as p } from "./locations";
import { DOMESTIC_ROAD, EU_ROAD, EU_SEA, NON_EU_SEA, documents, roadLeg, seaLeg } from "./plan";

type Booking = Omit<Shipment, "rawEvents">;

const bookings: Booking[] = [
  {
    // The vessel left Valencia 26 hours late, an hour ago; the operator's ETA hasn't moved yet.
    id: "SHP-1042",
    customerId: "cust-ostrel-de",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: false,
    legs: [
      roadLeg(1, "op-corvala", p.terrassa, p.valencia, [-100, -98, -94]),
      seaLeg(2, p.valencia, p.hamburg, [-90, -30, -27, 104, 108]),
      roadLeg(3, "op-quickfern", p.hamburg, p.ostrelHamburg, [114, 115, 124]),
    ],
    operatorEta: { date: hoursFromNow(124), source: "estimated" },
    plannedEta: hoursFromNow(124),
    documents: documents(EU_SEA),
  },
  {
    // Held by UK customs at Southampton; the packing list is missing.
    id: "SHP-1043",
    customerId: "cust-thornquist",
    originSiteId: "site-zaragoza",
    international: true,
    requiresCustoms: true,
    legs: [
      roadLeg(1, "op-corvala", p.zaragoza, p.valencia, [-150, -148, -140]),
      seaLeg(2, p.valencia, p.southampton, [-136, -120, -110, -14, -10], {
        submitted: -8,
        cleared: 4,
      }),
      roadLeg(3, "op-quickfern", p.southampton, p.thornquistManchester, [8, 9, 20]),
    ],
    operatorEta: { date: hoursFromNow(20), source: "estimated" },
    plannedEta: hoursFromNow(20),
    documents: documents(NON_EU_SEA, ["packing_list"]),
  },
  {
    // Domestic road delivery, on time.
    id: "SHP-1044",
    customerId: "cust-calvera",
    originSiteId: "site-terrassa",
    international: false,
    requiresCustoms: false,
    legs: [roadLeg(1, "op-corvala", p.terrassa, p.calveraValencia, [-5, -4, 3])],
    operatorEta: { date: hoursFromNow(3), source: "confirmed" },
    plannedEta: hoursFromNow(3),
    documents: documents(DOMESTIC_ROAD),
  },
  {
    // Stale: no operator update since the vessel left Leixões, almost 26 hours ago.
    id: "SHP-1045",
    customerId: "cust-ostrel-de",
    originSiteId: "site-porto",
    international: true,
    requiresCustoms: false,
    legs: [
      roadLeg(1, "op-corvala", p.porto, p.leixoes, [-60, -58, -54]),
      seaLeg(2, p.leixoes, p.hamburg, [-50, -30, -26, 60, 64]),
      roadLeg(3, "op-quickfern", p.hamburg, p.ostrelHamburg, [70, 71, 80]),
    ],
    operatorEta: { date: hoursFromNow(80), source: "estimated" },
    plannedEta: hoursFromNow(80),
    documents: documents(EU_SEA),
  },
  {
    // The vessel left Barcelona a day late, 70 minutes ago; the operator's ETA hasn't moved yet.
    id: "SHP-1046",
    customerId: "cust-thornquist",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: true,
    legs: [
      roadLeg(1, "op-corvala", p.terrassa, p.barcelona, [-60, -58, -52]),
      seaLeg(2, p.barcelona, p.southampton, [-50, -26, -25, 63, 67], {
        submitted: 69,
        cleared: 73,
      }),
      roadLeg(3, "op-quickfern", p.southampton, p.thornquistBirmingham, [75, 76, 83]),
    ],
    operatorEta: { date: hoursFromNow(83), source: "estimated" },
    plannedEta: hoursFromNow(83),
    documents: documents(NON_EU_SEA),
  },
  {
    // Delivered yesterday afternoon.
    id: "SHP-1047",
    customerId: "cust-calvera",
    originSiteId: "site-zaragoza",
    international: false,
    requiresCustoms: false,
    legs: [roadLeg(1, "op-quickfern", p.zaragoza, p.calveraMurcia, [-30, -28, -16])],
    operatorEta: { date: hoursFromNow(-16), source: "confirmed" },
    plannedEta: hoursFromNow(-16),
    documents: documents(DOMESTIC_ROAD),
  },
  {
    // At sea to Rotterdam; a vague operator email needs a person to review it.
    id: "SHP-1048",
    customerId: "cust-pellow",
    originSiteId: "site-terrassa",
    international: true,
    requiresCustoms: false,
    legs: [
      roadLeg(1, "op-corvala", p.terrassa, p.barcelona, [-50, -48, -44]),
      seaLeg(2, p.barcelona, p.rotterdam, [-42, -20, -18, 70, 74]),
      roadLeg(3, "op-quickfern", p.rotterdam, p.pellowRotterdam, [78, 79, 86]),
    ],
    operatorEta: { date: hoursFromNow(86), source: "estimated" },
    plannedEta: hoursFromNow(86),
    documents: documents(EU_SEA),
  },
  {
    // Long-haul road to Hamburg; the operator's update 40 minutes ago expects it 14 hours late.
    id: "SHP-1049",
    customerId: "cust-ostrel-de",
    originSiteId: "site-zaragoza",
    international: true,
    requiresCustoms: false,
    legs: [roadLeg(1, "op-corvala", p.zaragoza, p.ostrelHamburg, [-30, -28, 20])],
    operatorEta: { date: hoursFromNow(34), source: "estimated" },
    plannedEta: hoursFromNow(20),
    documents: documents(EU_ROAD),
  },
  {
    // Booked, not picked up yet.
    id: "SHP-1050",
    customerId: "cust-thornquist",
    originSiteId: "site-porto",
    international: true,
    requiresCustoms: true,
    legs: [
      roadLeg(1, "op-corvala", p.porto, p.leixoes, [20, 22, 26]),
      seaLeg(2, p.leixoes, p.southampton, [28, 40, 44, 110, 114], {
        submitted: 116,
        cleared: 120,
      }),
      roadLeg(3, "op-quickfern", p.southampton, p.thornquistLeeds, [122, 123, 134]),
    ],
    operatorEta: { date: hoursFromNow(134), source: "estimated" },
    plannedEta: hoursFromNow(134),
    documents: documents(NON_EU_SEA),
  },
];

/**
 * Every booking as a shipment with no operator updates applied yet. Each call returns a
 * full copy, so changing a returned shipment can never change the seed itself (which would
 * break "Reset demo" and every later call).
 */
export function getBookings(): Shipment[] {
  return bookings.map((b) => ({ ...structuredClone(b), rawEvents: [] }));
}
