/**
 * Saltwren Lines (sea): EDI-style lines with event codes and UTC times as `YYYYMMDDHHmm`.
 * Example: `SHP-1042|DEP|ESVLC|202610180630` (departed Valencia, 18 Oct 06:30 UTC).
 */
import type { MilestoneType, NormalizedEvent } from "@/lib/types";

const CODES: Record<string, MilestoneType> = {
  GIN: "gate_in",
  LOD: "loaded",
  DEP: "departed",
  ARR: "arrived",
  DIS: "discharged",
};

// Reference | event code | port code | time, e.g. SHP-1042|DEP|ESVLC|202610180630
const LINE_SHAPE = /^[^|]+\|[A-Z]{3}\|[A-Z]{5}\|\d{12}$/;

/**
 * Turns `202610180630` into `2026-10-18T06:30:00.000Z`. Rejects impossible dates such as
 * month 13 or 30 February, which the date parser would otherwise accept or roll over.
 */
function parseEdiTime(value: string, line: string): string {
  const [year, month, day, hour, minute] = [
    value.slice(0, 4),
    value.slice(4, 6),
    value.slice(6, 8),
    value.slice(8, 10),
    value.slice(10, 12),
  ];
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms) || new Date(ms).toISOString() !== iso) {
    throw new Error(`Saltwren sent an impossible time "${value}" in "${line}"`);
  }
  return iso;
}

/**
 * Reads one Saltwren line. Known codes are certain (confidence 1); an unknown code becomes
 * `null` with confidence 0 so ops can review it. A line that isn't in Saltwren's format at
 * all is rejected with an error naming the line, since it can't even be tied to a time.
 */
export function normalizeSaltwren(line: string): NormalizedEvent {
  const [ref, code, , time] = line.split("|");
  // The shape check guarantees all four parts; the undefined checks tell TypeScript so.
  if (!LINE_SHAPE.test(line) || ref === undefined || code === undefined || time === undefined) {
    throw new Error(`Not a Saltwren event line: "${line}"`);
  }
  const milestone = CODES[code] ?? null;
  return {
    shipmentId: ref,
    event: {
      operatorId: "op-saltwren",
      receivedAt: parseEdiTime(time, line),
      channel: "edi",
      original: line,
      normalizedTo: milestone,
      confidence: milestone === null ? 0 : 1,
    },
  };
}
