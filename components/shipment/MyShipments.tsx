"use client";

import { Inbox } from "lucide-react";
import { CustomerAlerts } from "@/components/shipment/CustomerAlerts";
import { EtaCounts } from "@/components/shipment/EtaCounts";
import { ShipmentCard } from "@/components/shipment/ShipmentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { customers } from "@/data/seed";
import { getShipments } from "@/data/shipments";
import { visibleShipments } from "@/lib/access";
import { rankExceptions } from "@/lib/ai/triage";
import { countByEta, customerAlerts, customerShipments, escalationAlerts } from "@/lib/customer";
import { useCurrentUser, useDemoStore } from "@/lib/store";
import { getNow } from "@/lib/time";
import styles from "./MyShipments.module.scss";

/** Built once: the seed data never changes until demo events arrive (F6). */
const allShipments = getShipments();

/**
 * The customer home (F4): summary bar, alerts, then one card per shipment, most urgent
 * first. Only the customer's own shipments, through `visibleShipments`; messages ops sent
 * are filtered to them too.
 */
export function MyShipments() {
  const user = useCurrentUser();
  const settledIds = useDemoStore((state) => state.settledIds);
  const sentAlerts = useDemoStore((state) => state.sentAlerts);
  if (!user) return null;
  const now = getNow();
  const mine = visibleShipments(user, allShipments);
  const views = customerShipments(mine, now);
  const ids = new Set(mine.map((s) => s.id));
  // Messages ops approved, AI delay alerts, and acknowledgements for items ops let run over; newest first.
  const alerts = [
    ...sentAlerts.filter((a) => ids.has(a.shipmentId)),
    ...customerAlerts(views),
    ...escalationAlerts(rankExceptions(mine, customers, now), new Set(settledIds), now),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (views.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={32} strokeWidth={1.75} />}
        title="No shipments yet."
        message="Shipments booked for you will appear here."
      />
    );
  }

  return (
    <div className={styles.page}>
      <EtaCounts counts={countByEta(views)} />
      <CustomerAlerts alerts={alerts} now={now} />
      <section aria-labelledby="shipments-heading" className={styles.shipments}>
        <h2 id="shipments-heading" className={styles.heading}>
          {views.length} {views.length === 1 ? "shipment" : "shipments"}
        </h2>
        <ul className={styles.grid}>
          {views.map((view) => (
            <li key={view.shipment.id} className={styles.item}>
              <ShipmentCard view={view} now={now} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
