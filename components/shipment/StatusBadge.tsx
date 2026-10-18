import { Anchor, Calendar, PackageCheck, Route, ShieldAlert, Ship, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { Mode, ShipmentStatus } from "@/lib/types";

export type StatusBadgeProps = {
  status: ShipmentStatus;
  /** The current leg's mode, so "In transit" shows a truck or a ship. Without it, a neutral route icon. */
  mode?: Mode;
};

/**
 * Where the shipment is: Planned, In transit, At port, Customs hold or Delivered.
 * Lateness has its own badge ({@link EtaStatusBadge}); the two are never merged (DESIGN §6).
 */
export function StatusBadge({ status, mode }: StatusBadgeProps) {
  const { tone, icon, label } = statusLook(status, mode);
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

const ICON = { size: 16, strokeWidth: 1.75 };

function statusLook(status: ShipmentStatus, mode: Mode | undefined): { tone: BadgeTone; icon: ReactNode; label: string } {
  switch (status) {
    case "planned":
      return { tone: "neutral", icon: <Calendar {...ICON} />, label: "Planned" };
    case "in_transit":
      return { tone: "info", icon: modeIcon(mode), label: "In transit" };
    case "at_port":
      return { tone: "info", icon: <Anchor {...ICON} />, label: "At port" };
    case "customs_hold":
      return { tone: "incident", icon: <ShieldAlert {...ICON} />, label: "Customs hold" };
    case "delivered":
      return { tone: "ontime", icon: <PackageCheck {...ICON} />, label: "Delivered" };
    default: {
      // Adding a status without giving it a look here fails to compile.
      const unhandled: never = status;
      throw new Error(`Unhandled shipment status: ${String(unhandled)}`);
    }
  }
}

function modeIcon(mode: Mode | undefined): ReactNode {
  switch (mode) {
    case "road":
      return <Truck {...ICON} />;
    case "sea":
      return <Ship {...ICON} />;
    case undefined:
      return <Route {...ICON} />;
    default: {
      const unhandled: never = mode;
      throw new Error(`Unhandled mode: ${String(unhandled)}`);
    }
  }
}
