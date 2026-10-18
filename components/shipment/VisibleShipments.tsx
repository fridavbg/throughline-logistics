"use client";

import { Inbox } from "lucide-react";
import { StatusBadge } from "@/components/shipment/StatusBadge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getShipments } from "@/data/shipments";
import { visibleShipments } from "@/lib/access";
import { getCurrentLeg, getShipmentStatus } from "@/lib/derived";
import { useCurrentUser } from "@/lib/store";
import styles from "./VisibleShipments.module.scss";

/** Built once: the seed data never changes until demo events arrive (F6). */
const allShipments = getShipments();

/**
 * A plain list of the shipments the current persona may see, so the perimeter can be
 * checked. Placeholder on the ops home until the attention inbox (F2) replaces it.
 */
export function VisibleShipments() {
  const user = useCurrentUser();
  if (!user) return null;
  const shipments = visibleShipments(user, allShipments);

  if (shipments.length === 0) {
    return <EmptyState icon={<Inbox size={32} strokeWidth={1.75} />} title="No shipments to show." />;
  }

  return (
    <section aria-labelledby="visible-shipments">
      <h2 id="visible-shipments" className={styles.heading}>
        {shipments.length} {shipments.length === 1 ? "shipment" : "shipments"}
      </h2>
      <ul className={styles.list}>
        {shipments.map((shipment) => {
          const first = shipment.legs[0];
          const last = shipment.legs.at(-1);
          return (
            <li key={shipment.id}>
              <Card as="article" className={styles.card}>
                <code className={styles.ref}>{shipment.id}</code>
                <span className={styles.route}>
                  {first?.from.name} → {last?.to.name}
                </span>
                <StatusBadge status={getShipmentStatus(shipment)} mode={getCurrentLeg(shipment)?.mode} />
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
