import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { MyShipments } from "@/components/shipment/MyShipments";

/**
 * The customer home, "My shipments" (F4). Next.js requires a default export for pages, so
 * this is an exception to named exports.
 */
export default function CustomerHome() {
  return (
    <AppShell title="My shipments" actions={<RoleSwitcher />}>
      <RoleGate role="customer">
        <MyShipments />
      </RoleGate>
    </AppShell>
  );
}
