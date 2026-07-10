import React from "react";
import ReactDOM from "react-dom/client";
// Fonts — bundled locally via @fontsource (woff2 emitted into the Vite output).
// Not loaded from Google Fonts: the Tauri CSP is `default-src 'self'` and the
// no-network threat model forbids external fetches.
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./shared/monaco.js";
import { App } from "./App.js";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
