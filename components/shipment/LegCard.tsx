import { ShieldCheck, Ship, Truck } from "lucide-react";
import { SourceTag } from "@/components/shipment/SourceTag";
import { Card } from "@/components/ui/Card";
import { operators } from "@/data/seed";
import { STEP_LABELS, type TimelineGroup, type TimelineStep } from "@/lib/detail";
import { formatDayTime } from "@/lib/time";
import type { Mode } from "@/lib/types";
import styles from "./LegCard.module.scss";

export type LegCardProps = {
  group: TimelineGroup;
  /** How many legs the shipment has, for "Leg 2 of 3". */
  legCount: number;
};

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true };

/**
 * One block on the timeline: a leg (mode, operator, from → to) or the customs steps at a port,
 * with each step done, next, still to come, or passed without a report.
 */
export function LegCard({ group, legCount }: LegCardProps) {
  return (
    <Card as="section" className={styles.legCard}>
      {group.kind === "leg" ? (
        <header className={styles.header}>
          <span className={styles.icon}>{group.leg.mode === "sea" ? <Ship {...ICON} /> : <Truck {...ICON} />}</span>
          <h3 className={styles.title}>
            Leg {group.leg.sequence} of {legCount} · {MODE_LABELS[group.leg.mode]}
          </h3>
          <p className={styles.meta}>
            {operators.find((o) => o.id === group.leg.operatorId)?.name ?? "Unknown operator"}
          </p>
          <p className={styles.meta}>
            {group.leg.from.name} → {group.leg.to.name}
          </p>
        </header>
      ) : (
        <header className={styles.header}>
          <span className={styles.icon}>
            <ShieldCheck {...ICON} />
          </span>
          <h3 className={styles.title}>Customs</h3>
          <p className={styles.meta}>{group.place.name}</p>
        </header>
      )}
      <ol className={styles.steps}>
        {group.steps.map((step) => (
          <Step key={`${step.milestone.type}-${step.milestone.plannedAt}`} step={step} />
        ))}
      </ol>
    </Card>
  );
}

/** A Record over the union fails to compile if a mode is added without words. */
const MODE_LABELS: Record<Mode, string> = { road: "Road", sea: "Sea" };

/** One step: the dot shows its state, and the text says it too, so color is never the only signal. */
function Step({ step }: { step: TimelineStep }) {
  const { milestone: m, state } = step;
  const isHold = m.type === "customs_hold" && state === "done";
  return (
    <li className={`${styles.step} ${styles[state]} ${isHold ? styles.hold : ""}`} aria-current={state === "current" ? "step" : undefined}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{STEP_LABELS[m.type]}</span>
      <span className={styles.when}>
        {m.at !== null ? (
          <>
            <time dateTime={m.at}>{formatDayTime(m.at)}</time>
            <SourceTag source={m.source} />
          </>
        ) : state === "not_reported" ? (
          "Not reported by the operator"
        ) : (
          <>
            {state === "current" && <strong className={styles.next}>Next</strong>}
            <span>
              Planned <time dateTime={m.plannedAt}>{formatDayTime(m.plannedAt)}</time>
            </span>
            <SourceTag source={m.source} />
          </>
        )}
      </span>
    </li>
  );
}
