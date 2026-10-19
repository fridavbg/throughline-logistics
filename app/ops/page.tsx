import { AppShell } from "@/components/layout/AppShell";
import { OpsNav } from "@/components/layout/OpsNav";
import { RoleGate } from "@/components/layout/RoleGate";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { AttentionInbox } from "@/components/shipment/AttentionInbox";

/**
 * The ops home, the attention inbox (F2). Next.js requires a default export for pages, so
 * this is an exception to named exports.
 */
export default function OpsHome() {
  return (
    <AppShell title="Attention" actions={<RoleSwitcher />} nav={<OpsNav />}>
      <RoleGate role="ops">
        <AttentionInbox />
      </RoleGate>
    </AppShell>
  );
}
