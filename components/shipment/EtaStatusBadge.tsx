import { CircleCheck, ClockAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { EtaStatus } from "@/lib/types";

export type EtaStatusBadgeProps = {
  status: EtaStatus;
};

/**
 * Whether the shipment will make it: On time, At risk or Late. Kept apart from
 * {@link StatusBadge}, and shown next to a {@link SourceTag} so it's clear who says so.
 */
export function EtaStatusBadge({ status }: EtaStatusBadgeProps) {
  const { tone, icon, label } = etaStatusLook(status);
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}

const ICON = { size: 16, strokeWidth: 1.75 };

function etaStatusLook(status: EtaStatus): { tone: BadgeTone; icon: ReactNode; label: string } {
  switch (status) {
    case "on_time":
      return { tone: "ontime", icon: <CircleCheck {...ICON} />, label: "On time" };
    case "at_risk":
      return { tone: "risk", icon: <ClockAlert {...ICON} />, label: "At risk" };
    case "late":
      return { tone: "incident", icon: <TriangleAlert {...ICON} />, label: "Late" };
    default: {
      // Adding an ETA status without giving it a look here fails to compile.
      const unhandled: never = status;
      throw new Error(`Unhandled ETA status: ${String(unhandled)}`);
    }
  }
}
