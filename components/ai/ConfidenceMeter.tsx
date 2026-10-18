import { confidenceLevel } from "@/lib/ai/confidence";
import type { ConfidenceLevel, User } from "@/lib/types";
import styles from "./ConfidenceMeter.module.scss";

export type ConfidenceMeterProps = {
  /** The AI's confidence, from 0 to 1. */
  confidence: number;
  /**
   * Who reads it. Below 0.6, ops sees "Needs review" (an action for them); a customer sees
   * "Awaiting update", since they can't review anything. Customers only get a low score from
   * a quiet operator (stale), so that's what it says.
   */
  audience: User["role"];
};

/**
 * How sure the AI is, as three bars plus a text label that's always visible:
 * High, Medium or Needs review ("Awaiting update" for customers). The bars are decorative;
 * the words carry the meaning.
 */
export function ConfidenceMeter({ confidence, audience }: ConfidenceMeterProps) {
  const level = confidenceLevel(confidence);
  const { bars, tone } = LOOK[level];
  const label = level === "needs_review" && audience === "customer" ? "Awaiting update" : LOOK[level].label;
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
