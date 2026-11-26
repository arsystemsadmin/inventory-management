"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, isolate, variantLabel } from "@/lib/format";
import { tClient } from "@/i18n/client";

type Table = "sales" | "items" | "time_entries" | "approval_requests" | "stores";

/**
 * Subscribes to Supabase Realtime for the given tables and re-renders the
 * current server components when anything changes. Realtime applies RLS per
 * subscriber, so users only receive events for rows they can read.
 * `intervalMs` adds a periodic refresh (e.g. live pay every 30 minutes).
 */
export function LiveRefresh({
  tables,
  intervalMs,
  toastSales = false,
  currentUserId,
}: {
  tables: Table[];
  intervalMs?: number;
  toastSales?: boolean;
  currentUserId?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };

    let channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (toastSales && table === "sales" && payload.eventType === "INSERT") {
          const s = payload.new as { item_name: string; size: string | null; color: string | null; quantity: number; total_cents: number; sold_by: string };
          if (s.sold_by !== currentUserId) {
            const v = variantLabel(s.size, s.color);
            toast.info(tClient("toasts.newSale", { label: `${s.quantity} × ${isolate(s.item_name)}${v ? ` (${v})` : ""}` }), {
              description: formatMoney(s.total_cents),
            });
          }
        }
        refresh();
      });
    }

    // Realtime needs the user's JWT to evaluate RLS.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    }).catch(() => {
      // Live updates are a nice-to-have: if they can't start, the page still works
      // (it also refreshes when the phone wakes up).
    });

    const interval = intervalMs ? setInterval(() => router.refresh(), intervalMs) : null;
    // Catch up after the phone wakes up / tab regains focus.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [key, intervalMs, toastSales, currentUserId, router]);

  return null;
}
