import 'dotenv/config';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import express from 'express';
import compression from 'compression';
import serveStatic from 'serve-static';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath, pathToFileURL } from 'url';

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resolve = (p: string) => path.resolve(__dirname, p);

const getStyleSheets = async () => {
  try {
    const assetpath = resolve('public');
    const files = await fs.readdir(assetpath);
    const cssAssets = files.filter(l => l.endsWith('.css'));
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

async function createServer(isProd = process.env.NODE_ENV === 'production') {
  const app = express();

  // ✅ ESENȚIAL: proxy + parser JSON înainte de rute
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  // ✅ Health pentru verificări rapide
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // ✅ Import robust al rutelor în funcție de mod (relativ la acest fișier)
  const apiUrl = isProd
    ? new URL('./src/server/routes/api.js', import.meta.url)
    : new URL('./src/server/routes/api.ts', import.meta.url);

  const apiModule = await import(apiUrl.href);
  const { triggerEvent } = apiModule;
  if (typeof triggerEvent === 'function') {
    app.post('/triggerEvent', triggerEvent); // alias compat cu frontendul tău
  } else {
    console.error('[server] triggerEvent NU e o funcție exportată din routes/api.*');
  }

  // Vite middleware (dev) / static (prod)
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: isTest ? 'error' : 'info',
    root: isProd ? 'dist' : '',
    optimizeDeps: { include: [] },
  });

  app.use(vite.middlewares);

  const assetsDir = resolve('public');
  const requestHandler = express.static(assetsDir);
  app.use(requestHandler);
  app.use('/public', requestHandler);

  if (isProd) {
    app.use(compression());
    app.use(
      serveStatic(resolve('client'), {
        index: false,
      })
    );
  }

  const stylesheets = getStyleSheets();

  // 1. Read index.html
  const baseTemplate = await fs.readFile(isProd ? resolve('client/index.html') : resolve('index.html'), 'utf-8');

  const productionBuildPath = path.join(__dirname, './server/entry-server.js');
  const devBuildPath = path.join(__dirname, './src/client/entry-server.tsx');
  const buildModule = isProd ? productionBuildPath : devBuildPath;
  const { render } = await vite.ssrLoadModule(buildModule);

  app.post('/chat', async (req: Request, res: Response) => {
    console.log('Server received in main:', req.body);
    // const data = req.body;
    // const response = await getChatResponse(data);
    // res.json({ response });
  });

  // SSR catch-all
  app.use('*', async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    try {
      const template = await vite.transformIndexHtml(url, baseTemplate);
      const appHtml = await render(url);
      const cssAssets = await stylesheets;
      const html = template.replace(`<!--app-html-->`, appHtml).replace(`<!--head-->`, cssAssets);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      if (e instanceof Error) {
        !isProd && vite.ssrFixStacktrace(e);
        console.log(e.stack);
        vite.ssrFixStacktrace(e);
        next(e);
      } else {
        console.error('Caught an exception that is not an Error:', e);
        next(e as any);
      }
    }
  });

  // ✅ ESENȚIAL: error handler ca să vezi mesajul real în 500
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[express error]', err);
    res.status(500).json({ error: 'internal', message: err?.message ?? 'unknown' });
  });

  const port = process.env.PORT || 1994;
  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`App is listening on http://localhost:${port}`);
  });
}

createServer();
