"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { tClient } from "@/i18n/client";
import { reportQuietly } from "@/lib/safe-call";

/**
 * Catches errors that escape everything else (failed promises, event
 * handlers): shows a friendly message, records it for developers, and keeps
 * the page usable.
 */
export function ErrorNet() {
  useEffect(() => {
    let last = 0;
    const notify = (kind: string, err: unknown) => {
      reportQuietly(kind, err);
      if (Date.now() - last < 4000) return; // don't stack identical toasts
      last = Date.now();
      toast.error(tClient(typeof navigator !== "undefined" && !navigator.onLine ? "errors.offline" : "errors.generic"));
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { digest?: string } | undefined;
      if (typeof r?.digest === "string" && r.digest.startsWith("NEXT_")) return; // Next.js navigation
      e.preventDefault();
      notify("unhandled-rejection", e.reason);
    };
    const onError = (e: ErrorEvent) => {
      if (!e.error) return; // resource / script load noise
      notify("unhandled-error", e.error);
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
