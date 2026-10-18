/**
 * Reads an operator's timestamp as an ISO string in UTC, or fails with a clear message.
 * Without this, a bad time either crashes with "Invalid time value" or, worse, slips
 * through as an impossible date (month 13) and breaks every time calculation after it.
 */
export function parseOperatorTime(value: string, operator: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`${operator} sent a time that isn't a valid date: "${value}"`);
  }
  return new Date(ms).toISOString();
}
