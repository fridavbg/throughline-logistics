import styles from "./AiLabel.module.scss";

/**
 * The shared marker on every AI output: the text "AI" in a dashed violet outline.
 * No icon and no tinted background, by design (DESIGN §6, AI components).
 */
export function AiLabel() {
  return <span className={styles.aiLabel}>AI</span>;
}
