import type { ReactNode } from "react";
import styles from "./Badge.module.scss";

/**
 * The meaning a badge carries. Each tone maps to one semantic color token pair, and is
 * always paired with an icon and a text label so it never relies on color alone.
 */
export type BadgeTone = "neutral" | "info" | "ontime" | "risk" | "incident";

export type BadgeProps = {
  tone: BadgeTone;
  /** A 16px lucide icon. It's decorative: the label says the same thing in words. */
  icon: ReactNode;
  /** The text a person reads, e.g. "Customs hold". */
  children: ReactNode;
};

/** A small pill with an icon and a label, used for statuses. */
export function Badge({ tone, icon, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}
