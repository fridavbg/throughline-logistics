import styles from "./AiReason.module.scss";

export type AiReasonProps = {
  /** Why the AI suggests this, in plain words, e.g. "Vessel departed 26h late from Valencia". */
  reason: string;
  /** The toggle text. Defaults to "Why?". */
  label?: string;
};

/**
 * The "why" behind an AI output, folded away until asked for. Uses native
 * `<details>`/`<summary>`, so it opens with Enter or Space and needs no JavaScript.
 */
export function AiReason({ reason, label = "Why?" }: AiReasonProps) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>{label}</summary>
      <p className={styles.reason}>{reason}</p>
    </details>
  );
}
