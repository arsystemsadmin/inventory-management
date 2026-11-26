import type { MetadataRoute } from "next";

/** Lets phones install Binventory to the home screen and open it full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Binventory",
    short_name: "Binventory",
    description: "Inventory, sales and shifts for pop-up stores.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Inventory", url: "/inventory", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sales", url: "/sales", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
