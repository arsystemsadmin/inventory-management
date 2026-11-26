export const LANGS = ["en", "he"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);
export const dirOf = (lang: Lang): "rtl" | "ltr" => (lang === "he" ? "rtl" : "ltr");
/** Locale for dates/times. */
export const localeOf = (lang: Lang) => (lang === "he" ? "he-IL" : "en-US");
export const LANG_LABELS: Record<Lang, string> = { en: "English", he: "עברית" };

/** Saved choice wins; otherwise Hebrew if the browser prefers it; otherwise English. */
export function pickLang(cookie: string | undefined, acceptLanguage: string | null | undefined): Lang {
  if (isLang(cookie)) return cookie;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("he") || first.startsWith("iw")) return "he";
  return DEFAULT_LANG;
}
