import { CircleCheck, ClockAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { EtaStatus, User } from "@/lib/types";

export type EtaStatusBadgeProps = {
  status: EtaStatus;
  /** Who reads it. Ops sees triage words ("At risk"); a customer sees what's expected ("Up to a day late"). */
  audience: User["role"];
};

/**
 * Whether the shipment will make it. Kept apart from {@link StatusBadge}, and shown next to
 * a {@link SourceTag} so it's clear who says so. Same tone and icon for both audiences;
 * only the words differ, since "At risk" can read to a customer as a risk to the goods.
 */
export function EtaStatusBadge({ status, audience }: EtaStatusBadgeProps) {
  const { tone, icon } = etaStatusLook(status);
  return (
    <Badge tone={tone} icon={icon}>
      {etaStatusLabel(status, audience)}
    </Badge>
  );
}

const ICON = { size: 16, strokeWidth: 1.75 };

function etaStatusLook(status: EtaStatus): { tone: BadgeTone; icon: ReactNode } {
  switch (status) {
    case "on_time":
      return { tone: "ontime", icon: <CircleCheck {...ICON} /> };
    case "at_risk":
      return { tone: "risk", icon: <ClockAlert {...ICON} /> };
    case "late":
      return { tone: "incident", icon: <TriangleAlert {...ICON} /> };
    default: {
      // Adding an ETA status without giving it a look here fails to compile.
      const unhandled: never = status;
      throw new Error(`Unhandled ETA status: ${String(unhandled)}`);
    }
  }
}

/** A Record over both unions fails to compile if a status or audience is added without words. */
const LABELS: Record<User["role"], Record<EtaStatus, string>> = {
  ops: { on_time: "On time", at_risk: "At risk", late: "Late" },
  // Matches the AI summary's wording (lib/ai/summarize.ts), so the card says one thing.
  customer: { on_time: "On time", at_risk: "Up to a day late", late: "More than a day late" },
};

/** The words for an ETA status, e.g. `etaStatusLabel("at_risk", "customer")` → "Up to a day late". */
export function etaStatusLabel(status: EtaStatus, audience: User["role"]): string {
  return LABELS[audience][status];
}
