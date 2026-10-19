import { AppShell } from "@/components/layout/AppShell";
import { OpsNav } from "@/components/layout/OpsNav";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { ShipmentPortfolio } from "@/components/shipment/ShipmentPortfolio";

/**
 * Every shipment in the persona's sites (F3). Next.js requires a default export for pages, so
 * this is an exception to named exports.
 */
export default function OpsShipments() {
  return (
    <AppShell title="Shipments" actions={<RoleSwitcher />} nav={<OpsNav />}>
      <RoleGate role="ops">
        <ShipmentPortfolio />
      </RoleGate>
    </AppShell>
  );
}
