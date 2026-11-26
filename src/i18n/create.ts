import i18next, { type i18n as I18n } from "i18next";
import en from "./locales/en";
import he from "./locales/he";
import type { Lang } from "./settings";

export const resources = { en: { translation: en }, he: { translation: he } } as const;

/** A fresh, synchronously-initialised i18next instance for one language. */
export function createI18n(lang: Lang, plugins: Parameters<I18n["use"]>[0][] = []): I18n {
  const instance = i18next.createInstance();
  for (const p of plugins) instance.use(p);
  void instance.init({
    resources,
    lng: lang,
    fallbackLng: "en",
    interpolation: { escapeValue: false }, // React already escapes
    initAsync: false,
    returnNull: false,
  });
  return instance;
}
