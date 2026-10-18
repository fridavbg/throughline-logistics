import styles from "./AiReason.module.scss";

export type AiReasonProps = {
  /** Why the AI suggests this, in plain words, e.g. "Vessel departed 26h late from Valencia". */
  reason: string;
};

/**
 * The "why" behind an AI output, folded away until asked for. Uses native
 * `<details>`/`<summary>`, so it opens with Enter or Space and needs no JavaScript.
 */
export function AiReason({ reason }: AiReasonProps) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>Why?</summary>
      <p className={styles.reason}>{reason}</p>
    </details>
  );
}
