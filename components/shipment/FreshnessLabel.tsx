import { Clock, ClockAlert } from "lucide-react";
import { getLastUpdateAt, isStale } from "@/lib/derived";
import { formatAgo, HOUR_MS } from "@/lib/time";
import type { Shipment } from "@/lib/types";
import styles from "./FreshnessLabel.module.scss";

export type FreshnessLabelProps = {
  shipment: Shipment;
  now: Date;
};

/**
 * When the operator last reported: "Updated 2h ago", or amber "Stale · 26h" once a moving
 * shipment has been quiet for more than 24h (DESIGN §6). The icon changes too, so color
 * is never the only signal.
 */
export function FreshnessLabel({ shipment, now }: FreshnessLabelProps) {
  const last = getLastUpdateAt(shipment);
  if (last === null) return <span className={styles.label}>No operator update yet</span>;

  if (isStale(shipment, now)) {
    const hours = Math.round((now.getTime() - Date.parse(last)) / HOUR_MS);
    return (
      <span className={`${styles.label} ${styles.stale}`}>
        <ClockAlert size={16} strokeWidth={1.75} aria-hidden="true" />
        Stale · {hours}h
      </span>
    );
  }
  return (
    <span className={styles.label}>
      <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
      Updated {formatAgo(last, now)}
    </span>
  );
}
