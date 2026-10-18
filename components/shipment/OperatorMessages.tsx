import { AiLabel } from "@/components/ai/AiLabel";
import { AiReason } from "@/components/ai/AiReason";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import { operators } from "@/data/seed";
import { messageReading, messagesNewestFirst } from "@/lib/detail";
import { formatAgo, formatDayTime } from "@/lib/time";
import type { Shipment } from "@/lib/types";
import styles from "./OperatorMessages.module.scss";

export type OperatorMessagesProps = {
  shipment: Shipment;
  now: Date;
};

/**
 * Every operator message exactly as received, newest first, next to how the AI read it (A1),
 * so ops can check the reading against the original. Ops only.
 */
export function OperatorMessages({ shipment, now }: OperatorMessagesProps) {
  const messages = messagesNewestFirst(shipment);
  return (
    <section aria-labelledby="messages-heading" className={styles.panel}>
      <h2 id="messages-heading" className={styles.heading}>
        Operator messages
      </h2>
      {messages.length === 0 ? (
        <p className={styles.empty}>No operator messages yet.</p>
      ) : (
        <ol className={styles.list}>
          {messages.map((event) => {
            const reading = messageReading(event);
            return (
              <li key={`${event.operatorId}-${event.receivedAt}-${event.original}`} className={styles.message}>
                <p className={styles.meta}>
                  <span>{operators.find((o) => o.id === event.operatorId)?.name ?? "Unknown operator"}</span>
                  <span className={styles.channel}>{event.channel.toUpperCase()}</span>
                  <time dateTime={event.receivedAt} title={formatDayTime(event.receivedAt)}>
                    {formatAgo(event.receivedAt, now)}
                  </time>
                </p>
                <pre className={styles.original}>{event.original}</pre>
                <div className={styles.reading}>
                  <p className={styles.readAs}>
                    <AiLabel /> {reading.readAs === null ? "Not recognised" : <>Read as: <strong>{reading.readAs}</strong></>}
                  </p>
                  <ConfidenceMeter confidence={event.confidence} audience="ops" />
                  <AiReason reason={reading.reason} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
