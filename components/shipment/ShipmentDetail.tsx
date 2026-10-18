"use client";

import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import { AiSummary } from "@/components/ai/AiSummary";
import { DocumentList } from "@/components/shipment/DocumentList";
import { EtaBlock } from "@/components/shipment/EtaBlock";
import { FreshnessLabel } from "@/components/shipment/FreshnessLabel";
import { OperatorMessages } from "@/components/shipment/OperatorMessages";
import { ShipmentExceptions } from "@/components/shipment/ShipmentExceptions";
import { SourceTag } from "@/components/shipment/SourceTag";
import { StatusBadge } from "@/components/shipment/StatusBadge";
import { Timeline } from "@/components/shipment/Timeline";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { customers } from "@/data/seed";
import { getShipments } from "@/data/shipments";
import { findVisibleShipment } from "@/lib/access";
import { toCustomerShipment } from "@/lib/customer";
import { getCurrentLeg } from "@/lib/derived";
import { homePath } from "@/lib/personas";
import { useCurrentUser } from "@/lib/store";
import { formatDay, getNow } from "@/lib/time";
import styles from "./ShipmentDetail.module.scss";

/** Built once: the seed data never changes until demo events arrive (F6). */
const allShipments = getShipments();

/** Invented address on a reserved domain (.example), so the link can never reach a real inbox. */
const SUPPORT_EMAIL = "support@throughline.example";

export type ShipmentDetailProps = {
  /** The shipment reference from the URL, e.g. "SHP-1042". */
  id: string;
};

/**
 * One shipment for either role (F5): status, arrival, the leg timeline and documents. Customers
 * also get the AI summary and a support link; ops get exceptions with actions and the original
 * operator messages. A shipment outside the persona's perimeter looks exactly like an unknown one.
 */
export function ShipmentDetail({ id }: ShipmentDetailProps) {
  const user = useCurrentUser();
  if (!user) return null;

  const home = homePath(user.role);
  const backLabel = user.role === "ops" ? "Back to Attention" : "Back to My shipments";
  const shipment = findVisibleShipment(user, allShipments, id);
  if (!shipment) {
    return (
      <EmptyState
        icon={<SearchX size={32} strokeWidth={1.75} />}
        title="We couldn't find that shipment"
        message="The link may be out of date, or the shipment isn't one you can see."
        action={
          <ButtonLink href={home} variant="primary">
            {backLabel}
          </ButtonLink>
        }
      />
    );
  }

  const now = getNow();
  const { status, eta, prediction, summary, delivery } = toCustomerShipment(shipment, now);
  const isOps = user.role === "ops";
  const customer = customers.find((c) => c.id === shipment.customerId);
  const from = shipment.legs[0]?.from.name ?? "Origin unknown";
  const to = shipment.legs.at(-1)?.to.name ?? "destination unknown";

  return (
    <div className={styles.page}>
      <Link className={styles.back} href={home}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        {backLabel}
      </Link>

      <header className={styles.header}>
        <h2 className={styles.title}>
          <code className={styles.ref}>{shipment.id}</code>
          <span className={styles.route}>
            {from} → {to}
          </span>
        </h2>
        {isOps && <p className={styles.customer}>{customer?.name ?? "Unknown customer"}</p>}
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
            audience={user.role}
            onHold={status === "customs_hold"}
          />
        )}
      </header>

      <div className={styles.layout}>
        <section aria-labelledby="journey-heading" className={styles.main}>
          <h2 id="journey-heading" className={styles.heading}>
            Journey
          </h2>
          <Timeline shipment={shipment} />
        </section>

        <div className={styles.side}>
          {isOps ? (
            <>
              <ShipmentExceptions shipment={shipment} now={now} />
              <OperatorMessages shipment={shipment} now={now} />
            </>
          ) : (
            <section aria-labelledby="summary-heading" className={styles.panel}>
              <h2 id="summary-heading" className={styles.heading}>
                Summary
              </h2>
              <AiSummary summary={summary} audience="customer" />
            </section>
          )}
          <DocumentList documents={shipment.documents} />
          {!isOps && (
            <section aria-labelledby="help-heading" className={styles.panel}>
              <h2 id="help-heading" className={styles.heading}>
                Questions about this shipment?
              </h2>
              <ButtonLink href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(shipment.id)}`}>
                Contact support
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
