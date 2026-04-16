import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { UiLocaleProvider } from "./i18n";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import "./styles/pax.css";
import "./styles/game-ui-upgrade.css";
import "./styles/game-ui-fidelity.css";
import "./styles/ui-cleanup-ezra.css";
import "./styles/game-ui-fidelity.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UiLocaleProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </UiLocaleProvider>
  </React.StrictMode>
);
