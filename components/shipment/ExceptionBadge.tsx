import { ClockAlert, FileWarning, ScanSearch, ShieldAlert, TimerOff, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { EXCEPTION_LABELS } from "@/lib/ai/triage";
import type { ExceptionType, Severity } from "@/lib/types";

export type ExceptionBadgeProps = {
  type: ExceptionType;
  severity: Severity;
};

/** What's wrong, e.g. "Customs hold": red when critical, amber when a warning, always with an icon. */
export function ExceptionBadge({ type, severity }: ExceptionBadgeProps) {
  return (
    <Badge tone={severity === "critical" ? "incident" : "risk"} icon={ICONS[type]}>
      {EXCEPTION_LABELS[type]}
    </Badge>
  );
}

const ICON = { size: 16, strokeWidth: 1.75 };

/** A Record over the union fails to compile if a new type is added without an icon. */
const ICONS: Record<ExceptionType, ReactNode> = {
  delay: <ClockAlert {...ICON} />,
  customs_hold: <ShieldAlert {...ICON} />,
  stale: <TimerOff {...ICON} />,
  missing_document: <FileWarning {...ICON} />,
  incident: <TriangleAlert {...ICON} />,
  needs_review: <ScanSearch {...ICON} />,
};
