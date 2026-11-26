import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ErrorNet } from "@/components/error-net";
import { I18nProvider } from "@/i18n/client";
import { getLang, getT } from "@/i18n/server";
import { dirOf } from "@/i18n/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: "Binventory", description: t("meta.description") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body>
        <I18nProvider lang={lang}>
          {children}
          <Toaster />
          <ErrorNet />
        </I18nProvider>
      </body>
    </html>
  );
}
