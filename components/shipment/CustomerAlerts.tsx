import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import { SourceTag } from "@/components/shipment/SourceTag";
import { formatAgo } from "@/lib/time";
import type { CustomerAlert } from "@/lib/types";
import styles from "./CustomerAlerts.module.scss";

export type CustomerAlertsProps = {
  alerts: CustomerAlert[];
  now: Date;
};

/**
 * Proactive alerts for the customer. An AI prediction carries its source tag and confidence,
 * so it never reads as the operator's word (DESIGN §6, AlertItem).
 */
export function CustomerAlerts({ alerts, now }: CustomerAlertsProps) {
  return (
    <section aria-labelledby="alerts-heading" className={styles.panel}>
      <h2 id="alerts-heading" className={styles.heading}>
        Alerts
      </h2>
      {alerts.length === 0 ? (
        <p className={styles.empty}>No alerts. We&apos;ll tell you here if a shipment is delayed.</p>
      ) : (
        <ul className={styles.list}>
          {alerts.map((alert) => (
            <li key={alert.id} className={styles.alert}>
              <span className={`${styles.icon} ${styles[alert.severity]}`} aria-hidden="true">
                {ICONS[alert.severity]}
              </span>
              <div className={styles.body}>
                <p className={styles.message}>{alert.message}</p>
                <p className={styles.meta}>
                  <SourceTag source={alert.source} />
                  {alert.confidence !== undefined && <ConfidenceMeter confidence={alert.confidence} audience="customer" />}
                  <time dateTime={alert.createdAt}>{formatAgo(alert.createdAt, now)}</time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ICON = { size: 20, strokeWidth: 1.75 };

/** A Record over the union fails to compile if a new severity is added without an icon. */
const ICONS: Record<CustomerAlert["severity"], ReactNode> = {
  info: <Info {...ICON} />,
  warning: <TriangleAlert {...ICON} />,
  critical: <CircleAlert {...ICON} />,
};
