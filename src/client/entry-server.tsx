import React from "react";
import ReactDOMServer from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import type { HelmetServerState } from "react-helmet-async";
import { App } from "./App";
import { createRoutesFromChildren, matchRoutes } from "react-router-dom";
import publicRoutes from "./routes/publicRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { weddingHubRoutes } from "./routes/weddingHubRoutes";
import { InitialDataContext, type InitialData } from "./ssr/initialData";
import { preloadAllSsrLazy, takeRenderedSsrLazyKeys } from "./routes/ssrLazy";
import { ALL_LOCATION_ROUTES } from "./pages/LocationSEO/locationData";
import "./index.css";

// City pages are one catch-all route in the app (LocationRoute) — list their paths here,
// so an unknown address still redirects instead of rendering the 404 page.
const knownRoutes = [
  ...publicRoutes.map(({ path }) => ({ path })),
  ...ALL_LOCATION_ROUTES.map(({ path }) => ({ path })),
  ...createRoutesFromChildren(adminRoutes),
  ...createRoutesFromChildren(weddingHubRoutes),
];

type HelmetContext = {
  helmet?: HelmetServerState;
};

// Pages that download only when opened (ssrLazy) are all loaded here once, so the
// server always renders them in full.
const lazyPagesReady = preloadAllSsrLazy();

export async function render(url: string, initialData: InitialData | null = null) {
  await lazyPagesReady;
  if (!matchRoutes(knownRoutes, url)) {
    return {
      appHtml: "",
      head: "",
      redirect: `/oferta/olx?notFound=${encodeURIComponent(url)}`,
    };
  }
  const helmetContext: HelmetContext = {};

  const app = (
    <React.StrictMode>
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <InitialDataContext.Provider value={initialData}>
            <App />
          </InitialDataContext.Provider>
        </StaticRouter>
      </HelmetProvider>
    </React.StrictMode>
  );

  const appHtml = ReactDOMServer.renderToString(app);
  // The browser loads these before hydrating, so its first render matches this HTML.
  const lazyKeys = takeRenderedSsrLazyKeys();
  const lazyScript = lazyKeys.length ? `<script>window.__SSR_LAZY__=${JSON.stringify(lazyKeys)}</script>` : "";
  const helmet = helmetContext.helmet;

  const head = helmet
    ? `
      ${helmet.title.toString()}
      ${helmet.meta.toString()}
      ${helmet.link.toString()}
      ${helmet.script.toString()}
    `
    : "";

  return {
    appHtml,
    head,
    // Goes right before </body> (index.html has no <!--head--> slot); still runs before the app.
    bodyEnd: lazyScript,
  };
}
