"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/app/actions/report";
import { useT } from "@/i18n/client";

/** Friendly fallback instead of Next's raw "Application error" page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // Record the crash in the developer error log (never shown to owners).
    void reportClientError({
      action: "page-crash", message: error.message || "Unknown error", digest: error.digest,
      path: window.location.pathname,
    }).catch(() => undefined);
  }, [error]);
  const t = useT();
  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">{t("errorPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("errorPage.body")}
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">{t("errorPage.code", { code: error.digest })}</p>}
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>{t("common.tryAgain")}</Button>
          <Button variant="outline" asChild><Link href="/app">{t("errorPage.backToApp")}</Link></Button>
        </div>
      </div>
    </main>
  );
}
