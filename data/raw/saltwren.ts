/**
 * Saltwren Lines EDI lines (docs/DATA_MODEL.md §6): samples for the adapter tests, and the
 * feed behind the seed shipments.
 */
import { hoursAgo, minutesAgo } from "@/lib/time";

/** Formats an ISO time as Saltwren's `YYYYMMDDHHmm` in UTC. */
function ediTime(iso: string): string {
  return iso.replace(/[-:T]/g, "").slice(0, 12);
}

function line(ref: string, code: string, port: string, iso: string): string {
  return `${ref}|${code}|${port}|${ediTime(iso)}`;
}

/** Lines that build the seed scenarios (docs/DATA_MODEL.md §7). */
export const saltwrenFeed: string[] = [
  line("SHP-1042", "GIN", "ESVLC", hoursAgo(90)),
  // "Vessel delayed at Valencia": loaded and departed 26 hours late (planned 30 and 27 hours ago).
  line("SHP-1042", "LOD", "ESVLC", hoursAgo(4)),
  line("SHP-1042", "DEP", "ESVLC", hoursAgo(1)),
  line("SHP-1043", "GIN", "ESVLC", hoursAgo(136)),
  line("SHP-1043", "LOD", "ESVLC", hoursAgo(120)),
  line("SHP-1043", "DEP", "ESVLC", hoursAgo(110)),
  line("SHP-1043", "ARR", "GBSOU", hoursAgo(14)),
  line("SHP-1043", "DIS", "GBSOU", hoursAgo(10)),
  line("SHP-1045", "GIN", "PTLEI", hoursAgo(50)),
  line("SHP-1045", "LOD", "PTLEI", hoursAgo(30)),
  // The last update before the feed went quiet: stale, and due for review within 10 minutes.
  line("SHP-1045", "DEP", "PTLEI", minutesAgo(25 * 60 + 52)),
  line("SHP-1046", "GIN", "ESBCN", hoursAgo(50)),
  // Loaded and departed a day late (planned 26 and 25 hours ago).
  line("SHP-1046", "LOD", "ESBCN", hoursAgo(2)),
  line("SHP-1046", "DEP", "ESBCN", minutesAgo(70)),
  line("SHP-1048", "GIN", "ESBCN", hoursAgo(42)),
  line("SHP-1048", "LOD", "ESBCN", hoursAgo(20)),
  line("SHP-1048", "DEP", "ESBCN", hoursAgo(18)),
];

/** Examples for the adapter tests, including a code we don't know. */
export const saltwrenSamples: string[] = [
  `SHP-1042|GIN|ESVLC|${ediTime(hoursAgo(90))}`,
  `SHP-1042|LOD|ESVLC|${ediTime(hoursAgo(40))}`,
  `SHP-1042|DEP|ESVLC|${ediTime(hoursAgo(20))}`,
  // An event code we don't know yet: read as unknown, sent to ops for review.
  `SHP-1042|RFT|ESVLC|${ediTime(hoursAgo(19))}`,
];
