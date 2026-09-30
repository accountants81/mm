import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV && typeof window !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(registration => registration.unregister())));
  if ("caches" in window) void window.caches.keys().then(keys => Promise.all(keys.map(key => window.caches.delete(key))));
}

if (import.meta.env.PROD && typeof window !== "undefined" && "serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then(async registration => {
        await registration.update();
        const cache = await caches.open("abd-accounting-shell-v8");
        const resources = [
          ...Array.from(document.scripts).map(script => script.src),
          ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => (link as HTMLLinkElement).href),
        ].filter(Boolean);
        await Promise.all(resources.map(async url => {
          try {
            const response = await fetch(url, { cache: "no-store" });
            if (response.ok) await cache.put(url, response.clone());
          } catch { /* the app remains usable when an optional resource is unavailable */ }
        }));
      })
      .catch(error => console.warn("[Offline] service worker registration failed", error));
  });
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
