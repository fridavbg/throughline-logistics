import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { VisibleShipments } from "@/components/shipment/VisibleShipments";

/**
 * The customer home. For now a plain list of the customer's shipments; "My shipments" (F4)
 * replaces it. Next.js requires a default export for pages, so this is an exception to named exports.
 */
export default function CustomerHome() {
  return (
    <AppShell title="My shipments" actions={<RoleSwitcher />}>
      <RoleGate role="customer">
        <VisibleShipments />
      </RoleGate>
    </AppShell>
  );
}
