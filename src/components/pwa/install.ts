"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Chrome/Edge/Samsung's install event (not in the DOM typings). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Captured as early as possible: the event can fire before any component mounts.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; notify(); });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export type InstallState = {
  /** Already running from the home screen. */
  standalone: boolean;
  /** iPhone/iPad: no install button exists; show Share → Add to Home Screen steps. */
  ios: boolean;
  /** iOS in a browser other than Safari (Chrome/Firefox app etc.). Newer iOS supports Add to Home Screen there too. */
  iosNotSafari: boolean;
  /** One-tap install is available (Android/desktop Chrome, Edge, Samsung Internet). */
  canPrompt: boolean;
  justInstalled: boolean;
  promptInstall: () => Promise<boolean>;
};

export function useInstall(): InstallState {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const justInstalled = useSyncExternalStore(subscribe, () => installed, () => false);
  const [env, setEnv] = useState({ standalone: false, ios: false, iosNotSafari: false });

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const ua = nav.userAgent;
    // iPadOS reports itself as a Mac; touch support gives it away.
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
    setEnv({
      standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
      ios,
      iosNotSafari: ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),
    });
  }, []);

  const promptInstall = async () => {
    if (!deferred) return false;
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    notify();
    return outcome === "accepted";
  };

  return { ...env, canPrompt, justInstalled, promptInstall };
}
