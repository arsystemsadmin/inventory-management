"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n/client";
import { useInstall } from "./install";

const DISMISS_KEY = "binventory-install-dismissed";

/** Step-by-step for iPhone/iPad, where Safari has no install button. */
function IosSteps({ open, onClose, notSafari }: { open: boolean; onClose: () => void; notSafari: boolean }) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("install.iosTitle")}</DialogTitle>
          <DialogDescription>{t("install.iosNote")}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-semibold">1</span>
            <span className="flex-1">{t("install.iosStep1")}</span>
            <Share className="size-5 shrink-0 text-sky-600" />
          </li>
          <li className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-semibold">2</span>
            <span className="flex-1">{t("install.iosStep2")}</span>
            <PlusSquare className="size-5 shrink-0" />
          </li>
          <li className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-semibold">3</span>
            <span className="flex-1">{t("install.iosStep3")}</span>
          </li>
        </ol>
        {notSafari && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">{t("install.iosUseSafari")}</p>}
        <Button onClick={onClose}>{t("install.gotIt")}</Button>
      </DialogContent>
    </Dialog>
  );
}

/** Dismissible strip at the top of the app, until installed or dismissed. */
export function InstallBanner() {
  const t = useT();
  const { standalone, ios, iosNotSafari, canPrompt, justInstalled, promptInstall } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);
  if (dismissed || standalone || justInstalled || !(canPrompt || ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <>
      <div className="border-b bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
          <Smartphone className="size-5 shrink-0" />
          <span className="flex-1">{t("install.bannerText")}</span>
          <Button size="sm" onClick={() => (canPrompt ? promptInstall() : setSteps(true))}>
            <Download /> {t("install.install")}
          </Button>
          <button type="button" onClick={dismiss} aria-label={t("install.dismiss")} className="rounded p-1 opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <IosSteps open={steps} onClose={() => setSteps(false)} notSafari={iosNotSafari} />
    </>
  );
}

/** Settings card: always available, even after dismissing the banner. */
export function InstallCard() {
  const t = useT();
  const { standalone, ios, iosNotSafari, canPrompt, justInstalled, promptInstall } = useInstall();
  const [steps, setSteps] = useState(false);

  let body: React.ReactNode;
  if (standalone || justInstalled) body = <p className="text-sm text-muted-foreground">{t("install.installed")}</p>;
  else if (canPrompt) body = <Button onClick={() => promptInstall()}><Download /> {t("install.install")}</Button>;
  else if (ios) body = <Button variant="outline" onClick={() => setSteps(true)}><Share /> {t("install.howTo")}</Button>;
  else body = <p className="text-sm text-muted-foreground">{t("install.browserMenu")}</p>;

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{t("install.cardNote")}</p>
      <div>{body}</div>
      <IosSteps open={steps} onClose={() => setSteps(false)} notSafari={iosNotSafari} />
    </div>
  );
}
