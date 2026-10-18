import { confidenceLevel } from "@/lib/ai/confidence";
import type { ConfidenceLevel } from "@/lib/types";
import styles from "./ConfidenceMeter.module.scss";

export type ConfidenceMeterProps = {
  /** The AI's confidence, from 0 to 1. */
  confidence: number;
};

/**
 * How sure the AI is, as three bars plus a text label that's always visible:
 * High, Medium or Needs review. The bars are decorative; the words carry the meaning.
 */
export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const level = confidenceLevel(confidence);
  const { bars, label, tone } = LOOK[level];
  return (
    <span className={`${styles.meter} ${tone}`}>
      <span className={styles.bars} aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={bar <= bars ? styles.barOn : styles.bar} />
        ))}
      </span>
      {label}
    </span>
  );
}

/** A Record over the union fails to compile if a new level is added without a look. */
const LOOK: Record<ConfidenceLevel, { bars: number; label: string; tone: string | undefined }> = {
  high: { bars: 3, label: "High confidence", tone: styles.confident },
  medium: { bars: 2, label: "Medium confidence", tone: styles.confident },
  needs_review: { bars: 1, label: "Needs review", tone: styles.needsReview },
};
