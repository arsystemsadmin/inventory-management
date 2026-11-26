export const SALES_RANGES = { today: 1, "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as const;
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

export type SalesBucket = "hour" | "day" | "week" | "month";
export const SALES_BUCKETS: SalesBucket[] = ["hour", "day", "week", "month"];
/** Sensible grouping for a range: hours for today … months for a year. */
export function defaultBucket(range: SalesRange): SalesBucket {
  return range === "today" ? "hour" : range === "90d" ? "week" : range === "12m" ? "month" : "day";
}
/** Groupings that give a readable number of bars for the range. */
export function bucketsFor(range: SalesRange): SalesBucket[] {
  switch (range) {
    case "today": return ["hour"];
    case "7d": return ["hour", "day"];
    case "30d": return ["day", "week"];
    case "90d": return ["day", "week", "month"];
    default: return ["week", "month"];
  }
}

/** Start of the bucket containing d (local time; weeks start on Sunday). */
export function bucketStart(d: Date, bucket: SalesBucket) {
  const x = new Date(d);
  if (bucket === "hour") { x.setMinutes(0, 0, 0); return x; }
  x.setHours(0, 0, 0, 0);
  if (bucket === "week") x.setDate(x.getDate() - x.getDay());
  if (bucket === "month") x.setDate(1);
  return x;
}
export function nextBucket(d: Date, bucket: SalesBucket) {
  const x = new Date(d);
  if (bucket === "hour") x.setHours(x.getHours() + 1);
  else if (bucket === "day") x.setDate(x.getDate() + 1);
  else if (bucket === "week") x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
}
