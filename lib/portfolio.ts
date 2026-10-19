/**
 * The ops portfolio (F3): every shipment in the persona's perimeter, not only the ones that
 * need attention, so ops can always find a shipment again after handling it. Pure and
 * computed every time, like the other views. Spec: docs/PRD.md §4 (F3).
 */
import { byUrgency, toCustomerShipment, type CustomerShipment } from "@/lib/customer";
import { getCurrentLeg } from "@/lib/derived";
import type { Customer, Mode, Operator, Shipment, Site } from "@/lib/types";

/** One row of the portfolio: the shipment's view plus the names ops reads it by. */
export type PortfolioRow = {
  /** The same status, ETA and prediction the detail page shows. */
  view: CustomerShipment;
  customer: string;
  origin: string;
  destination: string;
  /** The leg it's on now (the last leg once delivered), or `undefined` for a shipment with no legs. */
  current?: { mode: Mode; operator: string };
};

/** Reference data to put names on ids. */
export type PortfolioNames = {
  customers: Customer[];
  sites: Site[];
  operators: Operator[];
};

/**
 * One row per shipment, most urgent first (the same order as the customer view). Expects
 * shipments already filtered to the persona by `visibleShipments`. A name that can't be
 * found falls back to its id, so a gap in reference data shows instead of hiding a row.
 */
export function portfolioRows(shipments: Shipment[], names: PortfolioNames, now: Date): PortfolioRow[] {
  return shipments
    .map((shipment) => {
      const leg = getCurrentLeg(shipment);
      const row: PortfolioRow = {
        view: toCustomerShipment(shipment, now),
        customer: nameOf(names.customers, shipment.customerId),
        origin: nameOf(names.sites, shipment.originSiteId),
        destination: shipment.legs.at(-1)?.to.name ?? "Destination unknown",
        current: leg ? { mode: leg.mode, operator: nameOf(names.operators, leg.operatorId) } : undefined,
      };
      return row;
    })
    .sort((a, b) => byUrgency(a.view, b.view));
}

function nameOf(list: { id: string; name: string }[], id: string): string {
  return list.find((item) => item.id === id)?.name ?? id;
}
