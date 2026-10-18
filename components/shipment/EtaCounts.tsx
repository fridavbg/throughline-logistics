import { etaStatusLabel } from "@/components/shipment/EtaStatusBadge";
import type { EtaCounts as Counts } from "@/lib/customer";
import styles from "./EtaCounts.module.scss";

export type EtaCountsProps = {
  counts: Counts;
};

/**
 * The customer's summary bar: shipments by ETA status in customer words, and recent deliveries.
 * "ETA unknown" shows only when there is one, as it's the exception, not a usual state.
 */
export function EtaCounts({ counts }: EtaCountsProps) {
  const items = [
    { label: etaStatusLabel("on_time", "customer"), value: counts.on_time, tone: styles.ontime },
    { label: etaStatusLabel("at_risk", "customer"), value: counts.at_risk, tone: styles.risk },
    { label: etaStatusLabel("late", "customer"), value: counts.late, tone: styles.incident },
    ...(counts.unknown > 0
      ? [{ label: etaStatusLabel("unknown", "customer"), value: counts.unknown, tone: undefined }]
      : []),
    { label: "Delivered (30 days)", value: counts.delivered, tone: undefined },
  ];
  return (
    <dl className={styles.counts}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={[styles.value, item.tone].filter(Boolean).join(" ")}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
