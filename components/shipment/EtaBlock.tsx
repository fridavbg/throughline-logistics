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
};

/**
 * The answer to "when does it arrive?": the operator's ETA with its source and the ETA
 * status, and when the AI predicts otherwise, a second row with its window, confidence
 * and reason (DESIGN §6, EtaBlock).
 */
export function EtaBlock({ operatorEta, eta, prediction, audience }: EtaBlockProps) {
  return (
    <div className={styles.etaBlock}>
      <div className={styles.row}>
        <span className={styles.date}>{formatDay(operatorEta.date)}</span>
        <SourceTag source={operatorEta.source} />
        <EtaStatusBadge status={eta.status} audience={audience} />
      </div>
      {prediction && (
        <div className={styles.prediction}>
          <p className={styles.row}>
            <AiLabel />
            <span className={styles.range}>{formatDayRange(prediction.earliest, prediction.latest)}</span>
            <ConfidenceMeter confidence={prediction.confidence} audience={audience} />
          </p>
          <p className={styles.reason}>{prediction.reason}</p>
        </div>
      )}
    </div>
  );
}
