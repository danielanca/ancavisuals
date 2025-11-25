// src/client/entry-server.tsx
import React from "react";
import ReactDOMServer from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import type { HelmetServerState } from "react-helmet-async";
import { App } from "./App";
import "./index.css";

// tipul contextului pentru HelmetProvider pe server
type HelmetContext = {
  helmet?: HelmetServerState;
};

export function render(url: string) {
  // contextul în care Helmet scrie titlu, meta etc.
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
