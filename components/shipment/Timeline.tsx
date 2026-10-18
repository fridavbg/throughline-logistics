import { LegCard } from "@/components/shipment/LegCard";
import { timelineGroups } from "@/lib/detail";
import type { Shipment } from "@/lib/types";
import styles from "./Timeline.module.scss";

export type TimelineProps = {
  shipment: Shipment;
};

/**
 * "Where is it?" without a map: every leg in order of travel, with customs as its own block
 * between the sea leg and the last road leg (DESIGN §6, Leg timeline).
 */
export function Timeline({ shipment }: TimelineProps) {
  const groups = timelineGroups(shipment);
  return (
    <ol className={styles.timeline}>
      {groups.map((group) => (
        <li key={group.kind === "leg" ? `leg-${group.leg.sequence}` : `customs-${group.place.name}`}>
          <LegCard group={group} legCount={shipment.legs.length} />
        </li>
      ))}
    </ol>
  );
}
