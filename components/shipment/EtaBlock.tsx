import { AiLabel } from "@/components/ai/AiLabel";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import { EtaStatusBadge } from "@/components/shipment/EtaStatusBadge";
import { SourceTag } from "@/components/shipment/SourceTag";
import { formatDay, formatDayRange } from "@/lib/time";
import type { Eta, EtaPrediction, EtaStatusWithSource, User } from "@/lib/types";
import styles from "./EtaBlock.module.scss";

export type EtaBlockProps = {
  operatorEta: Eta;
  eta: EtaStatusWithSource;
  /** A prediction firm enough to show. Shown below the operator's ETA, never instead of it. */
  prediction?: EtaPrediction;
  /** Who reads it, for the ETA status and confidence words. */
  audience: User["role"];
  /** Customs is holding the shipment: no release time is known, so no date is shown at all. */
  onHold: boolean;
  /** A smaller date, for a table row instead of a card. */
  compact?: boolean;
};

/**
 * The answer to "when does it arrive?": the operator's ETA with its source, and when the AI
 * predicts otherwise, a second row with its window, confidence and reason (DESIGN §6, EtaBlock).
 * The ETA status badge sits in the row whose ETA it was judged from, so a lateness the AI
 * predicted carries the `AI` label and never reads as the operator's word.
 */
export function EtaBlock({ operatorEta, eta, prediction, audience, onHold, compact = false }: EtaBlockProps) {
  const badge = <EtaStatusBadge status={eta.status} audience={audience} />;
  if (onHold) {
    // Matches the AI summary: a date next to "ETA unknown" would contradict it.
    return (
      <div className={styles.etaBlock}>
        <p className={styles.row}>
          <span className={styles.held}>Arrival date depends on when it&apos;s released</span>
          {badge}
        </p>
      </div>
    );
  }

  const fromAi = eta.source === "ai_predicted" && prediction !== undefined;
  return (
    <div className={styles.etaBlock}>
      <div className={styles.row}>
        <span className={compact ? styles.dateCompact : styles.date}>{formatDay(operatorEta.date)}</span>
        <SourceTag source={operatorEta.source} />
        {!fromAi && badge}
      </div>
      {prediction && (
        <div className={styles.prediction}>
          <p className={styles.row}>
            <AiLabel />
            <span className={styles.range}>{formatDayRange(prediction.earliest, prediction.latest)}</span>
            {fromAi && badge}
            <ConfidenceMeter confidence={prediction.confidence} audience={audience} />
          </p>
          <p className={styles.reason}>{prediction.reason}</p>
        </div>
      )}
    </div>
  );
}
