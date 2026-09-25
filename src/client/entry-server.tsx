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
import "./index.css";

const knownRoutes = [
  ...publicRoutes.map(({ path }) => ({ path })),
  ...createRoutesFromChildren(adminRoutes),
  ...createRoutesFromChildren(weddingHubRoutes),
];

type HelmetContext = {
  helmet?: HelmetServerState;
};

export function render(url: string) {
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
          <App />
        </StaticRouter>
      </HelmetProvider>
    </React.StrictMode>
  );

  const appHtml = ReactDOMServer.renderToString(app);
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
  };
}
