import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { TFunction } from "i18next";
import { getI18n } from "./create";
import { LANG_COOKIE, pickLang, type Lang } from "./settings";

/** Language for this request: the saved cookie, else the browser's preference. */
export const getLang = cache(async (): Promise<Lang> => {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
});

/** Translation function for server components and server actions. */
export const getT = cache(async (): Promise<TFunction> => getI18n(await getLang()).t);

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Untyped translate for keys built at runtime (error codes, validation messages). */
export async function getTr(): Promise<Translate> {
  const t = await getT();
  return (key, options) => (t as unknown as Translate)(key, options);
}
