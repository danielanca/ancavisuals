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
import eventRouter  from "./src/server/routes/event.route";
import QRRouter from "./src/server/routes/QRMoment.routes";
import assistantChatRouter from "./src/server/routes/assistantChat.routes";
import adminCalendarRouter from "./src/server/routes/adminCalendar.routes";
import chatbotRouter from "./src/server/routes/chatbot.routes";
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max per fișier
});
const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD;
const isProd = process.env.NODE_ENV === 'production';

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

async function createServer() {
  const app = express();

  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

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
  app.use("/api/album", albumRouter);
  app.use("/f", fileRouter);
  app.use("/api/download", downloadRouter);
  app.use("/api/share", shareRouter);
  app.use("/api/event",eventRouter);
  app.use("/api/urlcheck",QRRouter);
  app.use("/api/assistant", assistantChatRouter);
  app.use("/api/admin", adminCalendarRouter);
  app.use("/api/chatbot", chatbotRouter);

app.post('/api/upload-qr-moment', upload.array('files', 25), async (req: Request, res: Response) => {
  const { eventId, type } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!eventId || !files?.length) {
    return res.status(400).json({ error: 'Lipsește eventId sau fișiere' });
  }

  // Credențiale Bunny din .env (copiază Password-ul din FTP & API access)
  const bunnyHostname = 'storage.bunnycdn.com';
  const storageZone = 'ancavisuals-romania'; // numele zonei tale exact din dashboard
  const accessKey = process.env.BUNNY_STORAGE_PASSWORD;

  if (!accessKey) {
    console.error('Lipsește BUNNY_STORAGE_PASSWORD în .env');
    return res.status(500).json({ error: 'Configurare server eronată' });
  }

  try {
    const uploadPromises = files.map(async (file) => {
      const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const folderName =  "qr-moment"
      let detectedType: 'photo' | 'video' | 'audio';

      const mime = file.mimetype.toLowerCase();
      const ext = file.originalname.toLowerCase().split('.').pop() || '';
    
      if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        detectedType = 'photo';
      } else if (mime.startsWith('video/') && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
        detectedType = 'video';
      } else if (mime.startsWith('audio/') && ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'webm'].includes(ext)) {
        detectedType = 'audio';
      } else {
        // Unknown / unsupported file type → reject or fallback
        throw new Error(`Unsupported file type: ${file.mimetype} (${file.originalname})`);
      }
      
      const bunnyPath = `/${storageZone}/${eventId}/${folderName}/${detectedType}/${safeFileName}`;

      console.log(+" : "+mime);
      const response = await fetch(`https://${bunnyHostname}${bunnyPath}`, {
          method: 'PUT',
          headers: {
            'AccessKey': accessKey,
            'Content-Type': 'application/octet-stream',
          },
          body: file.buffer,
        });
      
      if (!response.ok) {
        throw new Error(`Bunny upload failed for ${file.originalname}: ${response.status}`);
      }

      return safeFileName;
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      uploadedCount: uploadedFiles.length,
      message: 'Fișiere încărcate cu succes pe Bunny!',
    });
  } catch (error: any) {
    console.error('Bunny upload error:', error);
    res.status(500).json({ error: 'Eroare la upload pe Bunny' });
  }
});


  let vite: ViteDevServer | undefined;
  let template: string;
  let render: (url: string) => Promise<string>;

  const stylesheetsPromise = getStyleSheets();

  if (!isProd) {
    // ******** DEV MODE (HMR ON) ********
    vite = await createViteServer({
      server: { middlewareMode: true },
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

    try {
      let htmlTemplate = template;
      let appHtml: string;

      if (!isProd && vite) {
        // dev: transform html + load entry via Vite
        htmlTemplate = await vite.transformIndexHtml(url, htmlTemplate);
        const devModule = await vite.ssrLoadModule(
          '/src/client/entry-server.tsx',
        );
        appHtml = await devModule.render(url);
      } else {
        // prod: use prebuilt server bundle
        appHtml = await render(url);
      }

      const cssAssets = await stylesheetsPromise;
      const html = htmlTemplate
        .replace(`<!--app-html-->`, appHtml)
        .replace(`<!--head-->`, cssAssets);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      if (!isProd && vite && e instanceof Error) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e);
      next(e as any);
    }
  });

  // error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[express error]', err);
    res.status(500).json({ error: 'internal', message: err?.message ?? 'unknown' });
  });

  const port = process.env.PORT || 1994;
  app.listen(Number(port), '127.0.0.1', () => {
  console.log(`App is listening on http://127.0.0.1:${port}`);
});
}

createServer();
