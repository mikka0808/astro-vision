import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

declare global {
  interface Window {
    __ASTRO_VISION_SW_REGISTERED__?: boolean;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Impossible de trouver l'élément racine #root");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && !window.__ASTRO_VISION_SW_REGISTERED__) {
  window.__ASTRO_VISION_SW_REGISTERED__ = true;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/astro-vision/sw.js`)
      .catch(() => {
        // Ignorer les erreurs silencieusement : l'app reste fonctionnelle même sans cache hors-ligne.
      });
  });
}
