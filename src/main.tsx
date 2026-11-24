import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { initLocale } from "./i18n";
import { useLocale } from "./i18n/nodes";
import { migrateLegacyStorage } from "./model/legacy";

migrateLegacyStorage();

/** Renders the app again in the chosen language whenever the language changes; open dialogs and panels stay open. */
function Root() {
  useLocale();
  return <App />;
}

void initLocale().then(() =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  ),
);
