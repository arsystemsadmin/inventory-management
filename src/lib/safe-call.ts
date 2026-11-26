"use client";

import { unstable_rethrow } from "next/navigation";
import { reportClientError } from "@/app/actions/report";
import { tClient } from "@/i18n/client";

/** Message for a request that failed before a proper answer came back. */
export function connectionErrorMessage(): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return tClient(offline ? "errors.offline" : "errors.server");
}

/** Records a browser-side failure in the developer error log (best effort, never throws). */
export function reportQuietly(action: string, err: unknown) {
  try {
    void reportClientError({
      action,
      message: err instanceof Error ? err.message : String(err),
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      details: { kind: "client-call", online: typeof navigator !== "undefined" ? navigator.onLine : null },
    }).catch(() => undefined);
  } catch { /* logging must never break the app */ }
}

type AnyAction = (...args: never[]) => Promise<unknown>;

/**
 * Wraps a server/demo action so it can never throw into the UI: network
 * failures, crashed or garbled server responses all become a normal
 * `{ ok: false, error }` result with a message in the user's language.
 */
export function safeAction<F extends AnyAction>(name: string, fn: F): F {
  return (async (...args: Parameters<F>) => {
    try {
      const result = await fn(...args);
      if (result == null || typeof result !== "object") {
        reportQuietly(`${name}:bad-response`, new Error(`Unexpected response: ${String(result)}`));
        return { ok: false, error: tClient("errors.server") };
      }
      return result;
    } catch (e) {
      unstable_rethrow(e); // let Next.js redirects (e.g. after sign-in) through
      reportQuietly(name, e);
      return { ok: false, error: connectionErrorMessage() };
    }
  }) as F;
}

export function safeActions<T extends Record<string, AnyAction>>(actions: T): T {
  return Object.fromEntries(Object.entries(actions).map(([k, fn]) => [k, safeAction(k, fn)])) as T;
}
