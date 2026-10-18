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
