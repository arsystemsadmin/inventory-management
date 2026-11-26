"use client";

import { useLocale } from "@/i18n/client";

/** Formats an ISO timestamp in the viewer's timezone (servers run in UTC). */
export function LocalTime({ iso, mode = "datetime" }: { iso: string | null | undefined; mode?: "datetime" | "time" | "date" }) {
  const locale = useLocale();
  if (!iso) return <>—</>;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    mode === "time" ? { hour: "numeric", minute: "2-digit" }
    : mode === "date" ? { weekday: "short", month: "short", day: "numeric" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  return <time dateTime={iso} suppressHydrationWarning>{d.toLocaleString(locale, opts)}</time>;
}
