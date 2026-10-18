import { AiLabel } from "@/components/ai/AiLabel";
import { AiReason } from "@/components/ai/AiReason";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import type { ShipmentSummary, User } from "@/lib/types";
import styles from "./AiSummary.module.scss";

export type AiSummaryProps = {
  summary: ShipmentSummary;
  /** Who reads it, for the confidence words. */
  audience: User["role"];
};

/**
 * The AI's short answer to "where is it?" (A5) as a list of points, with the `AI` label,
 * its confidence and the "why" every AI output carries (DESIGN §6).
 */
export function AiSummary({ summary, audience }: AiSummaryProps) {
  return (
    <div className={styles.aiSummary}>
      <AiLabel />
      <ul className={styles.points}>
        {summary.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className={styles.meta}>
        <ConfidenceMeter confidence={summary.confidence} audience={audience} />
        <AiReason reason={summary.reason} />
      </div>
    </div>
  );
}
