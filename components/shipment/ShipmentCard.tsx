import { AiSummary } from "@/components/ai/AiSummary";
import { EtaBlock } from "@/components/shipment/EtaBlock";
import { FreshnessLabel } from "@/components/shipment/FreshnessLabel";
import { SourceTag } from "@/components/shipment/SourceTag";
import { StatusBadge } from "@/components/shipment/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CustomerShipment } from "@/lib/customer";
import { getCurrentLeg } from "@/lib/derived";
import { formatDay } from "@/lib/time";
import styles from "./ShipmentCard.module.scss";

export type ShipmentCardProps = {
  view: CustomerShipment;
  now: Date;
};

/**
 * One shipment for a customer: destination, ref, status, freshness, arrival and the AI summary
 * (DESIGN §6), with a link to its detail page.
 */
export function ShipmentCard({ view, now }: ShipmentCardProps) {
  const { shipment, status, eta, prediction, summary, delivery } = view;
  const destination = shipment.legs.at(-1)?.to.name ?? "Destination unknown";
  return (
    <Card as="article" className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.destination}>{destination}</h3>
        <code className={styles.ref}>{shipment.id}</code>
      </header>
      <div className={styles.status}>
        <StatusBadge status={status} mode={getCurrentLeg(shipment)?.mode} />
        {!delivery && <FreshnessLabel shipment={shipment} now={now} />}
      </div>
      {delivery ? (
        <p className={styles.delivered}>
          <span className={styles.date}>Delivered {formatDay(delivery.at)}</span>
          <SourceTag source={delivery.source} />
        </p>
      ) : (
        <EtaBlock
          operatorEta={shipment.operatorEta}
          eta={eta}
          prediction={prediction}
          audience="customer"
          onHold={status === "customs_hold"}
        />
      )}
      <AiSummary summary={summary} audience="customer" />
      <ButtonLink href={`/shipments/${shipment.id}`} aria-label={`View details of ${shipment.id}`}>
        View details
      </ButtonLink>
    </Card>
  );
}
