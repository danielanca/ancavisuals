import 'dotenv/config';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { fileURLToPath, pathToFileURL } from 'url';
import albumRouter from './src/server/routes/album.routes';
import fileRouter from './src/server/routes/file.routes';
import downloadRouter from './src/server/routes/download.routes';
import shareRouter from "./src/server/routes/share.routes";
import eventRouter from "./src/server/routes/event.routes";
import qrMomentRouter from "./src/server/routes/QRMoment.routes";
import assistantChatRouter from "./src/server/routes/assistantChat.routes";
import adminCalendarRouter from "./src/server/routes/adminCalendar.routes";
import publicBookedDatesRouter from "./src/server/routes/publicBookedDates.routes";
import adminEventsRouter from "./src/server/routes/adminEvents.routes";
import chatbotRouter from "./src/server/routes/chatbot.routes";
import uploadRouter from "./src/server/routes/upload.routes";
import blogRouter from "./src/server/routes/blog.routes";
import contractsRouter from "./src/server/routes/contracts.routes";
import inspirationRouter from "./src/server/routes/inspiration.routes";
import mementosRouter from "./src/server/routes/mementos.routes";
import { analyticsPublicRouter, analyticsAdminRouter } from "./src/server/routes/analytics.routes";
import { startMementosCron } from "./src/server/cron/mementos.cron";
import { startAnalyticsCron } from "./src/server/cron/analytics.cron";

// Shared HTTP defaults used by both local development and the production server.
const BODY_PAYLOAD_LIMIT = "5mb";
const DEFAULT_APP_PORT = 1994;
const API_ROUTE_PREFIXES = {
  album: "/api/album",
  files: "/f",
  download: "/api/download",
  share: "/api/share",
  event: "/api/event",
  qrCheck: "/api/urlcheck",
  assistant: "/api/assistant",
  admin: "/api/admin",
  chatbot: "/api/chatbot",
  uploads: "/api",
  blog: "/api/blog",
  contracts: "/api/contracts",
} as const;

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD;
const isProd = process.env.NODE_ENV === 'production';
const isPlaywright = process.env.PLAYWRIGHT === "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resolve = (p: string) => path.resolve(__dirname, p);

const getStyleSheets = async () => {
  try {
    const assetpath = resolve('public');
    const files = await fs.readdir(assetpath);
    const cssAssets = files.filter((l) => l.endsWith('.css'));
    const allContent: string[] = [];
    for (const asset of cssAssets) {
      const content = await fs.readFile(path.join(assetpath, asset), 'utf-8');
      allContent.push(`<style type="text/css">${content}</style>`);
    }
    return allContent.join('\n');
  } catch {
    return '';
  }
};

const isAssetRequest = (url: string) => {
  const pathname = url.split("?")[0];
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/public/assets/") ||
    pathname.startsWith("/@") ||          // Vite virtual modules (/@vite/client, @react-refresh, etc.)
    pathname.startsWith("/node_modules/") || // pre-bundled deps
    /\.[a-z0-9]+$/i.test(pathname)
  );
};

async function createServer() {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: BODY_PAYLOAD_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_PAYLOAD_LIMIT }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  

  // --- API routes ---
  const apiUrl = isProd
    ? new URL('./src/server/routes/api.js', import.meta.url)
    : new URL('./src/server/routes/api.ts', import.meta.url);

  const apiModule = await import(apiUrl.href);
  const { triggerEvent } = apiModule;
  if (typeof triggerEvent === 'function') {
    app.post('/triggerEvent', triggerEvent);
  }

  // --- Static assets from /public ---
  const assetsDir = resolve('public');
  const requestHandler = express.static(assetsDir);
  
  app.use(requestHandler);
  app.use('/public', requestHandler);
  app.use(API_ROUTE_PREFIXES.album, albumRouter);
  app.use(API_ROUTE_PREFIXES.files, fileRouter);
  app.use(API_ROUTE_PREFIXES.download, downloadRouter);
  app.use(API_ROUTE_PREFIXES.share, shareRouter);
  app.use(API_ROUTE_PREFIXES.event, eventRouter);
  app.use(API_ROUTE_PREFIXES.qrCheck, qrMomentRouter);
  app.use(API_ROUTE_PREFIXES.assistant, assistantChatRouter);
  app.use(API_ROUTE_PREFIXES.admin, adminCalendarRouter);
  app.use("/api/booked-dates", publicBookedDatesRouter);
  app.use(API_ROUTE_PREFIXES.admin, adminEventsRouter);
  app.use(API_ROUTE_PREFIXES.chatbot, chatbotRouter);
  app.use(API_ROUTE_PREFIXES.uploads, uploadRouter);
  app.use(API_ROUTE_PREFIXES.blog, blogRouter);
  app.use(API_ROUTE_PREFIXES.contracts, contractsRouter);
  app.use(API_ROUTE_PREFIXES.admin, inspirationRouter);
  app.use(API_ROUTE_PREFIXES.admin, mementosRouter);
  app.use("/api/analytics", analyticsPublicRouter);
  app.use(API_ROUTE_PREFIXES.admin, analyticsAdminRouter);

  startMementosCron();
  startAnalyticsCron();

  let vite: ViteDevServer | undefined;
  let template: string;
  let render: (url: string) => Promise<{ appHtml: string; head: string }>;

  const stylesheetsPromise = getStyleSheets();

  if (!isProd) {
    // ******** DEV MODE (HMR ON) ********
    vite = await createViteServer({
      server: { host: '127.0.0.1', middlewareMode: true, hmr: isPlaywright ? false : undefined },
      appType: 'custom',
      logLevel: isTest ? 'error' : 'info',
    });

    app.use(vite.middlewares);

    template = await fs.readFile(resolve('index.html'), 'utf-8');
  } else {
    // ******** PROD MODE (NO HMR, NO @vite/client) ********
    app.use(compression());
    app.use(
      serveStatic(resolve('client'), {
        index: false,
      }),
    );

    template = await fs.readFile(resolve('client/index.html'), 'utf-8');

    const prodEntryUrl = pathToFileURL(
      path.join(__dirname, './server/entry-server.js'),
    ).href;
    const prodModule = await import(prodEntryUrl);
    render = prodModule.render;
  }

  // --- SSR handler ---
  app.use('*', async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    if (isAssetRequest(url)) {
      res.status(404).type("text/plain").end("Asset not found");
      return;
    }

    try {
      let htmlTemplate = template;
      let appHtml = "";
      let head = "";
      if (!isProd && vite) {
        // dev: transform html + load entry via Vite
        htmlTemplate = await vite.transformIndexHtml(url, htmlTemplate);
        const devModule = await vite.ssrLoadModule(
          '/src/client/entry-server.tsx',
        );
        ({ appHtml, head } = await devModule.render(url));
      } else {
        // prod: use prebuilt server bundle
        ({ appHtml, head } = await render(url));
      }

      const cssAssets = await stylesheetsPromise;
      const html = htmlTemplate
        .replace(`<!--app-html-->`, appHtml)
        .replace(`<!--head-->`, head + "\n" + cssAssets);

      res
        .status(200)
        .set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, max-age=0',
        })
        .end(html);
    } catch (e) {
      if (!isProd && vite && e instanceof Error) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e);
      next(e instanceof Error ? e : new Error("Unknown SSR render error"));
    }
  });

  // error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[express error]', err);
    res.status(500).json({ error: 'internal', message: err?.message ?? 'unknown' });
  });

  const port = process.env.PORT || DEFAULT_APP_PORT;
  app.listen(Number(port), '127.0.0.1', () => {
  console.log(`App is listening on http://127.0.0.1:${port}`);
});
}

createServer();
