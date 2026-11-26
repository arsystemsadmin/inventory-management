import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ErrorNet } from "@/components/error-net";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { I18nProvider } from "@/i18n/client";
import { getLang, getT } from "@/i18n/server";
import { dirOf } from "@/i18n/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "Binventory",
    description: t("meta.description"),
    applicationName: "Binventory",
    // iPhone/iPad: open full-screen from the home screen with our icon and name.
    appleWebApp: { capable: true, title: "Binventory", statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
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
          <RegisterServiceWorker />
        </I18nProvider>
      </body>
    </html>
  );
}
