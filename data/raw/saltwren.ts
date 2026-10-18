/**
 * Sample Saltwren Lines EDI lines (docs/DATA_MODEL.md §6).
 * The feeds behind each seed shipment are added with the seed scenarios (#8).
 */
import { hoursAgo } from "@/lib/time";

/** Formats an ISO time as Saltwren's `YYYYMMDDHHmm` in UTC. */
function ediTime(iso: string): string {
  return iso.replace(/[-:T]/g, "").slice(0, 12);
}

export const saltwrenSamples: string[] = [
  `SHP-1042|GIN|ESVLC|${ediTime(hoursAgo(90))}`,
  `SHP-1042|LOD|ESVLC|${ediTime(hoursAgo(40))}`,
  `SHP-1042|DEP|ESVLC|${ediTime(hoursAgo(20))}`,
  // An event code we don't know yet: read as unknown, sent to ops for review.
  `SHP-1042|RFT|ESVLC|${ediTime(hoursAgo(19))}`,
];
