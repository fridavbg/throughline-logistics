import styles from "./Skeleton.module.scss";

export type SkeletonProps = {
  /** Any CSS length, ideally a token, e.g. "60%" or "var(--space-6)". Defaults to the full width. */
  width?: string;
  /** Any CSS length. Defaults to one line of text. */
  height?: string;
};

/**
 * A muted placeholder block shaped like the content that's loading. Hidden from screen
 * readers: the region around it should set `aria-busy="true"` instead.
 */
export function Skeleton({ width = "100%", height = "1lh" }: SkeletonProps) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}
