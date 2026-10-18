"use client";

import { ExceptionBadge } from "@/components/shipment/ExceptionBadge";
import { ExceptionRow } from "@/components/shipment/ExceptionRow";
import { customers, sites } from "@/data/seed";
import { exceptionOutcome, OUTCOME_LABELS } from "@/lib/detail";
import { inboxItems } from "@/lib/inbox";
import { useDemoStore } from "@/lib/store";
import { formatAgo } from "@/lib/time";
import type { Shipment } from "@/lib/types";
import styles from "./ShipmentExceptions.module.scss";

export type ShipmentExceptionsProps = {
  shipment: Shipment;
  now: Date;
};

/**
 * The shipment's exceptions for ops: open ones with the same actions as the inbox, then the ones
 * dealt with in this demo session and how. Ops only.
 */
export function ShipmentExceptions({ shipment, now }: ShipmentExceptionsProps) {
  const handledIds = useDemoStore((state) => state.handledIds);
  const settledIds = useDemoStore((state) => state.settledIds);
  const sentAlerts = useDemoStore((state) => state.sentAlerts);
  // Every exception on this shipment, including handled ones, so the history can show them.
  const items = inboxItems([shipment], customers, sites, [], now);
  const withOutcome = items.map((item) => ({
    item,
    outcome: exceptionOutcome(item.exception.id, { handledIds, settledIds, sentAlerts }),
  }));
  const open = withOutcome.filter((x) => x.outcome === "open");
  const dealtWith = withOutcome.filter((x) => x.outcome !== "open");

  return (
    <section aria-labelledby="exceptions-heading" className={styles.panel}>
      <h2 id="exceptions-heading" className={styles.heading}>
        Exceptions
      </h2>
      {open.length === 0 ? (
        <p className={styles.empty}>Nothing needs attention on this shipment.</p>
      ) : (
        <ol className={styles.list}>
          {open.map(({ item }) => (
            <li key={item.exception.id}>
              <ExceptionRow item={item} now={now} linkToShipment={false} />
            </li>
          ))}
        </ol>
      )}
      {dealtWith.length > 0 && (
        <>
          <h3 className={styles.subheading}>Dealt with in this session</h3>
          <ul className={styles.history}>
            {dealtWith.map(({ item, outcome }) => (
              <li key={item.exception.id} className={styles.historyItem}>
                <ExceptionBadge type={item.exception.type} severity={item.exception.severity} />
                <span className={styles.outcome}>{OUTCOME_LABELS[outcome]}</span>
                <span className={styles.muted}>
                  {item.exception.impact} · detected {formatAgo(item.exception.detectedAt, now)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
