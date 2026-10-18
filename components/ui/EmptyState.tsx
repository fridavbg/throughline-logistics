import type { ReactNode } from "react";
import styles from "./EmptyState.module.scss";

export type EmptyStateProps = {
  /** A lucide icon, decorative. */
  icon: ReactNode;
  /** One line that says what's good or what happened, e.g. "Nothing needs attention right now." */
  title: string;
  message?: string;
  /** An optional next step, e.g. a {@link ButtonLink} back to the start. */
  action?: ReactNode;
  /** Use "h1" when the empty state is the whole page, such as a 404. */
  titleAs?: "h1" | "h2";
};

/** Shown when a view has nothing to show, or what was asked for doesn't exist. */
export function EmptyState({ icon, title, message, action, titleAs: Title = "h2" }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <Title className={styles.title}>{title}</Title>
      {message && <p className={styles.message}>{message}</p>}
      {action}
    </div>
  );
}
