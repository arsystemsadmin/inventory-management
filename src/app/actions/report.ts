"use server";

import { z } from "zod";
import { logError } from "@/lib/error-log";

const schema = z.object({
  action: z.string().trim().min(1).max(100),
  message: z.string().max(2000),
  digest: z.string().max(200).optional(),
  path: z.string().max(500).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Records an error that happened in the browser (page crash, upload failure…). */
export async function reportClientError(input: unknown): Promise<void> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  const { action, message, digest, path, details } = parsed.data;
  await logError({
    action, message, source: "client", code: digest ? `DIGEST:${digest}` : null,
    details: { ...(details ?? {}), clientPath: path },
  });
}
