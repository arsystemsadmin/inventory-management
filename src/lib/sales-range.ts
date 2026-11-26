export const SALES_RANGES = { today: 1, "7d": 7, "30d": 30 } as const;
export type SalesRange = keyof typeof SALES_RANGES;

export function parseSalesRange(r?: string): SalesRange {
  return (r && r in SALES_RANGES ? r : "7d") as SalesRange;
}
/** Local midnight at the start of the range. */
export function salesRangeStart(range: SalesRange, now = new Date()) {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (SALES_RANGES[range] - 1));
  return since;
}
