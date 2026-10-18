import { Check } from "lucide-react";
import type { DataSource } from "@/lib/types";
import styles from "./SourceTag.module.scss";

export type SourceTagProps = {
  source: DataSource;
};

/**
 * Where a time or status comes from. Sits next to every ETA and milestone time, so
 * confirmed, estimated and AI-predicted values never look the same (DESIGN §6).
 */
export function SourceTag({ source }: SourceTagProps) {
  switch (source) {
    case "confirmed":
      return (
        <span className={`${styles.tag} ${styles.confirmed}`}>
          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          Confirmed
        </span>
      );
    case "estimated":
      return <span className={`${styles.tag} ${styles.estimated}`}>Operator estimate</span>;
    case "ai_predicted":
      // The bold "AI" is the shared AI marker; read together it says "AI prediction".
      return (
        <span className={`${styles.tag} ${styles.aiPredicted}`}>
          <span className={styles.aiWord}>AI</span> prediction
        </span>
      );
    default: {
      // Adding a source without giving it a look here fails to compile.
      const unhandled: never = source;
      throw new Error(`Unhandled data source: ${String(unhandled)}`);
    }
  }
}
