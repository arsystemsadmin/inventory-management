export const isYmd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
