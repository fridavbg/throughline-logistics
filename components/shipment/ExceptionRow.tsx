"use client";

import { AiLabel } from "@/components/ai/AiLabel";
import { AiReason } from "@/components/ai/AiReason";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import { DraftMessage } from "@/components/ai/DraftMessage";
import { ExceptionBadge } from "@/components/shipment/ExceptionBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { approvedAlert, responseLabel, routeLabel, type InboxItem } from "@/lib/inbox";
import { useDemoStore } from "@/lib/store";
import { formatAgo } from "@/lib/time";
import type { NextAction } from "@/lib/types";
import styles from "./ExceptionRow.module.scss";

export type ExceptionRowProps = {
  item: InboxItem;
  now: Date;
};

/** A Record over the union fails to compile if a new action is added without a button label. */
const ACTION_LABELS: Record<NextAction, string> = {
  notify_customer: "Notify customer",
  contact_operator: "Contact operator",
  request_document: "Request document",
  review_update: "Mark reviewed",
};

/**
 * One item in the attention inbox: what's wrong, how soon to respond, and the AI's suggested
 * next action with its button (DESIGN §6, ExceptionRow). A card on every width; the layout
 * spreads out from md.
 */
export function ExceptionRow({ item, now }: ExceptionRowProps) {
  const handle = useDemoStore((state) => state.handle);
  const resolve = useDemoStore((state) => state.resolve);
  const send = useDemoStore((state) => state.send);
  const { exception: e, shipment, customer, draft } = item;
  const countdown = responseLabel(e, now);
  const actionLabel = ACTION_LABELS[e.suggestedAction];

  return (
    <Card as="article" className={styles.row}>
      <header className={styles.header}>
        <span className={styles.score} aria-label={`Priority ${e.priorityScore} of 100`}>
          {e.priorityScore}
        </span>
        <h3 className={styles.title}>
          <code className={styles.ref}>{shipment.id}</code> <span>{customer?.name ?? "Unknown customer"}</span>
        </h3>
        <ExceptionBadge type={e.type} severity={e.severity} />
      </header>
      <p className={styles.route}>{routeLabel(item)}</p>
      <p className={styles.facts}>
        <span>Impact: {e.impact}</span>
        <span className={styles[countdown.tone]}>{countdown.text}</span>
        <span className={styles.muted}>Detected {formatAgo(e.detectedAt, now)}</span>
      </p>

      <div className={styles.suggestion}>
        <p className={styles.action}>
          <AiLabel /> <strong>{actionLabel}</strong>: {e.actionReason}
        </p>
        <ConfidenceMeter confidence={e.confidence} audience="ops" />
        <AiReason label="Why this rank?" reason={e.priorityReason} />
      </div>

      <div className={styles.buttons}>
        {draft ? (
          <DraftMessage
            draft={draft}
            recipient={customer?.name ?? "the customer"}
            trigger={<Button variant="primary">{actionLabel}</Button>}
            onApprove={(text) => send(e.id, approvedAlert(draft, e.severity, text, now))}
          />
        ) : (
          <Button variant="primary" onClick={() => handle(e.id)}>
            {actionLabel}
          </Button>
        )}
        <Button onClick={() => resolve(e.id)}>Resolve</Button>
        <Button variant="ghost" onClick={() => handle(e.id)}>
          Snooze
        </Button>
      </div>
    </Card>
  );
}
