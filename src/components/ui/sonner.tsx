"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useLang } from "@/i18n/client";
import { dirOf } from "@/i18n/settings";

export function Toaster(props: ToasterProps) {
  return <Sonner position="top-center" richColors closeButton dir={dirOf(useLang())} {...props} />;
}
