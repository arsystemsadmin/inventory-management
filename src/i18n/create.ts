import i18next, { type i18n as I18n } from "i18next";
import en from "./locales/en";
import he from "./locales/he";
import type { Lang } from "./settings";

export const resources = { en: { translation: en }, he: { translation: he } } as const;

/**
 * A synchronously-initialised i18next instance for one language.
 * Prefer getI18n(), which reuses instances: building one per request costs
 * CPU time, and Cloudflare Workers' free plan allows very little per request.
 */
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

// One instance per language (and per plugin setup), reused for every request.
// Instances are never switched to another language, so sharing them is safe.
const cache = new Map<string, I18n>();
export function getI18n(lang: Lang, key = "plain", plugins: Parameters<I18n["use"]>[0][] = []): I18n {
  const id = `${key}:${lang}`;
  let inst = cache.get(id);
  if (!inst) {
    inst = createI18n(lang, plugins);
    cache.set(id, inst);
  }
  return inst;
}
