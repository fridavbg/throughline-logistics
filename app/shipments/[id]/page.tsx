import { AppShell } from "@/components/layout/AppShell";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { ShipmentDetail } from "@/components/shipment/ShipmentDetail";
import { getShipments } from "@/data/shipments";

/**
 * One page per seed shipment, built at deploy time, so the demo stays fully static. Who may
 * see which shipment is decided in the browser, where the persona lives (RATIONALE §2).
 */
export function generateStaticParams(): { id: string }[] {
  return getShipments().map((shipment) => ({ id: shipment.id }));
}

/** Any id not built above, such as a typo, gets the app's 404 page. */
export const dynamicParams = false;

/**
 * The shared shipment detail (F5): ops and customers open the same URL and each see their
 * version. Next.js requires a default export for pages, so this is an exception to named exports.
 */
export default async function ShipmentPage({ params }: PageProps<"/shipments/[id]">) {
  // Since Next.js 15, params arrive as a Promise.
  const { id } = await params;
  return (
    <AppShell title="Shipment details" actions={<RoleSwitcher />}>
      <RoleGate>
        <ShipmentDetail id={id} />
      </RoleGate>
    </AppShell>
  );
}
