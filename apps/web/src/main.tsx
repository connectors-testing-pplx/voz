import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@voz/ui";
import { StoreProvider } from "./lib/store";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </I18nProvider>
  </StrictMode>,
);
