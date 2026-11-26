"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LANG_COOKIE, LANGS, dirOf, type Lang } from "@/i18n/settings";

const SHORT: Record<Lang, string> = { en: "EN", he: "עב" };

/** EN / עב toggle. Saves the choice in a cookie so server-rendered text matches. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const current = i18n.language as Lang;

  const choose = (lang: Lang) => {
    if (lang === current) return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    void i18n.changeLanguage(lang);
    router.refresh();
  };

  return (
    <div role="group" aria-label={t("common.language")} className={cn("inline-flex rounded-md border p-0.5 text-xs font-semibold", className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={l === current}
          className={cn("rounded px-2 py-1", l === current ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
