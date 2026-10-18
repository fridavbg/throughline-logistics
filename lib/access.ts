/**
 * Who can see which shipment. Customers see only their own; ops users see the shipments
 * leaving their sites, or every site when their perimeter is "all". Spec: docs/DATA_MODEL.md §5.
 */
import type { Shipment, User } from "@/lib/types";

/** Whether this user may see this shipment. */
export function canView(user: User, shipment: Shipment): boolean {
  switch (user.role) {
    case "customer":
      return shipment.customerId === user.customerId;
    case "ops":
      return user.siteIds === "all" || user.siteIds.includes(shipment.originSiteId);
    default: {
      // Adding a role without handling it here fails to compile.
      const unhandled: never = user;
      throw new Error(`Unhandled user role: ${JSON.stringify(unhandled)}`);
    }
  }
}

/** The shipments this user may see, in the order given. */
export function visibleShipments(user: User, shipments: Shipment[]): Shipment[] {
  return shipments.filter((shipment) => canView(user, shipment));
}

/**
 * The shipment with this id, if this user may see it. A shipment outside their perimeter is
 * `undefined` too, so the page says "not found" and never reveals that the id exists.
 */
export function findVisibleShipment(user: User, shipments: Shipment[], id: string): Shipment | undefined {
  const shipment = shipments.find((s) => s.id === id);
  return shipment && canView(user, shipment) ? shipment : undefined;
}
