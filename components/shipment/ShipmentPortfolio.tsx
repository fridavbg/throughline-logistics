"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { EtaBlock } from "@/components/shipment/EtaBlock";
import { FreshnessLabel } from "@/components/shipment/FreshnessLabel";
import { SourceTag } from "@/components/shipment/SourceTag";
import { StatusBadge } from "@/components/shipment/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { customers, operators, sites } from "@/data/seed";
import { visibleShipments } from "@/lib/access";
import { portfolioRows } from "@/lib/portfolio";
import { useCurrentUser, useShipments } from "@/lib/store";
import { formatDay, getNow } from "@/lib/time";
import type { Mode } from "@/lib/types";
import styles from "./ShipmentPortfolio.module.scss";

const MODE_LABELS: Record<Mode, string> = { road: "Road", sea: "Sea" };

/**
 * Every shipment in the persona's sites (F3), most urgent first, each linking to its detail
 * page. A table from md; below that each row stacks into a card with its column names.
 * Stale rows show the amber freshness label (DESIGN §7).
 */
export function ShipmentPortfolio() {
  const user = useCurrentUser();
  const allShipments = useShipments();
  if (!user) return null;

  const now = getNow();
  const rows = portfolioRows(visibleShipments(user, allShipments), { customers, sites, operators }, now);
  if (rows.length === 0) {
    return <EmptyState icon={<PackageSearch size={32} strokeWidth={1.75} />} title="No shipments in your sites yet." />;
  }

  return (
    <section aria-labelledby="portfolio-heading" className={styles.portfolio}>
      <h2 id="portfolio-heading" className={styles.heading}>
        {rows.length} shipment{rows.length === 1 ? "" : "s"}
      </h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Shipment</th>
              <th scope="col">Route</th>
              <th scope="col">Now on</th>
              <th scope="col">Status</th>
              <th scope="col">ETA</th>
              <th scope="col">Last update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ view, customer, origin, destination, current }) => {
              const { shipment, status, eta, prediction, delivery } = view;
              return (
                <tr key={shipment.id}>
                  <td data-label="Shipment">
                    <Link className={styles.ref} href={`/shipments/${shipment.id}`}>
                      {shipment.id}
                    </Link>
                    <span className={styles.sub}>{customer}</span>
                  </td>
                  <td data-label="Route">
                    {origin} → {destination}
                  </td>
                  <td data-label="Now on">
                    {current ? `${MODE_LABELS[current.mode]} · ${current.operator}` : "No legs"}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={status} mode={current?.mode} />
                  </td>
                  <td data-label="ETA">
                    {delivery ? (
                      <span className={styles.delivered}>
                        Delivered {formatDay(delivery.at)} <SourceTag source={delivery.source} />
                      </span>
                    ) : (
                      <EtaBlock
                        operatorEta={shipment.operatorEta}
                        eta={eta}
                        prediction={prediction}
                        audience="ops"
                        onHold={status === "customs_hold"}
                        compact
                      />
                    )}
                  </td>
                  <td data-label="Last update">
                    <FreshnessLabel shipment={shipment} now={now} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
