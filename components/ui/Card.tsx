import type { ReactNode } from "react";
import styles from "./Card.module.scss";

export type CardProps = {
  /** The element to render: `article` for a self-contained item such as one shipment. */
  as?: "div" | "section" | "article";
  className?: string;
  children: ReactNode;
};

/** A bordered surface for grouping content. Cards use a border, not a shadow (DESIGN §4). */
export function Card({ as: Element = "div", className, children }: CardProps) {
  return <Element className={[styles.card, className].filter(Boolean).join(" ")}>{children}</Element>;
}
