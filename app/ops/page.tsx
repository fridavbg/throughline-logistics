import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { VisibleShipments } from "@/components/shipment/VisibleShipments";

/**
 * The ops home. For now a plain list of the persona's shipments; the attention inbox (F2)
 * replaces it. Next.js requires a default export for pages, so this is an exception to named exports.
 */
export default function OpsHome() {
  return (
    <AppShell title="Shipments" actions={<RoleSwitcher />}>
      <RoleGate role="ops">
        <VisibleShipments />
      </RoleGate>
    </AppShell>
  );
}
