"use client";

import { useEffect } from "react";
import "./install"; // start listening for the install event right away

/** Registers the service worker (production only) so the app can be installed. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* installing still works without it */ });
  }, []);
  return null;
}
