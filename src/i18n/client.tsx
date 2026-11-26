"use client";

import { useEffect, useMemo } from "react";
import type { i18n as I18n, TFunction } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { createI18n } from "./create";
import { dirOf, localeOf, type Lang } from "./settings";

// Instance for code that isn't a component (e.g. browser demo actions).
let current: I18n | null = null;

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const i18n = useMemo(() => createI18n(lang, [initReactI18next]), [lang]);
  current = i18n;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** The app's translation hook: `const t = useT(); t("nav.inventory")`. */
export function useT(): TFunction {
  return useTranslation().t;
}

export function useLang(): Lang {
  return useTranslation().i18n.language as Lang;
}

/** Locale for dates/times in the current language (he-IL / en-US). */
export function useLocale(): string {
  return localeOf(useLang());
}

/** Translate outside React components (falls back to English before the provider mounts). */
export function tClient(key: string, options?: Record<string, unknown>): string {
  if (!current) current = createI18n("en");
  return (current.t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, options);
}
