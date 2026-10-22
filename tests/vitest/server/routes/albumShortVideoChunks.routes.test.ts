// @vitest-environment node
/*
 * Purpose: the album "Video scurt" chunked upload. Cloudflare refuses requests over 100 MB, so the
 * admin sends the video in pieces; the server writes them, in order, into ONE PUT to Bunny and
 * only answers with the video once Bunny has the whole file. Out-of-order pieces are refused.
 */
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let server: Server | null = null;

async function start(bunnyStatus = 201) {
  const received: { url: string; bytes: Buffer }[] = [];
  const nodeFetch = vi.fn(async (url: string, init?: { method?: string; body?: NodeJS.ReadableStream }) => {
    if (init?.method === "PUT") {
      const parts: Buffer[] = [];
      for await (const part of init.body!) parts.push(Buffer.from(part as Buffer));
      received.push({ url, bytes: Buffer.concat(parts) });
      return { ok: bunnyStatus < 300, status: bunnyStatus, text: async () => "" };
    }
    if (init?.method === "DELETE") return { ok: true, status: 200 };
    // Directory listing: the uploaded file, with the size Bunny stored.
    const listed = received.map((entry) => ({ ObjectName: entry.url.split("/").pop(), Length: entry.bytes.length }));
    return { ok: true, status: 200, json: async () => listed };
  });
  vi.doMock("node-fetch", () => ({ default: nodeFetch }));
  vi.doMock("src/server/middleware/requireFirebaseAuth", () => ({
    requireFirebaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireSupremeAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  }));
  vi.doMock("src/server/constants/bunny", async () => ({
    ...(await vi.importActual<object>("src/server/constants/bunny")),
    buildBunnyDirectoryUrl: (...segments: string[]) => `https://storage.test/${segments.join("/")}/`,
    buildBunnyStorageUrl: (...segments: string[]) => `https://storage.test/${segments.join("/")}`,
    getBunnyStorageKey: () => "key",
  }));
  vi.doMock("src/server/utils/signBunnyUrl", () => ({ signBunnyUrl: (path: string) => `https://cdn.test${path}` }));
  vi.doMock("src/server/services/album.service", () => ({ invalidateAlbumCache: vi.fn(), loadAlbum: vi.fn(), resolveAlbumSlug: async (slug: string) => slug }));
  vi.doMock("src/server/services/albumShortVideoStream.service", () => ({
    startShortVideoStream: vi.fn(), getShortVideoStream: vi.fn().mockResolvedValue(null), removeShortVideoStream: vi.fn(),
  }));
  vi.doMock("src/server/firestore", () => ({ firestore: () => ({}) }));

  const express = (await import("express")).default;
  const router = (await import("src/server/routes/album.routes")).default;
  const { uploadOriginCors } = await import("src/server/middleware/uploadOriginCors");
  const app = express();
  app.use(uploadOriginCors);
  app.use(express.json());
  app.use("/api/album", router);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/album/nunta-test/short-video`;
  return { base, received };
}

// node:http, not fetch: the shared test setup replaces fetch with a stub.
function send(url: string, method: string, body: Buffer, contentType: string): Promise<{ status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { "Content-Type": contentType, "Content-Length": body.length } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (part: Buffer) => parts.push(part));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, json: async () => { const text = Buffer.concat(parts).toString(); try { return JSON.parse(text || "{}"); } catch { throw new Error(text.slice(0, 600)); } } }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

const begin = (base: string, size: number) =>
  send(`${base}/uploads`, "POST", Buffer.from(JSON.stringify({ name: "Video Nuntă.MOV", size })), "application/json")
    .then((r) => r.json() as Promise<{ uploadId: string }>);
const piece = (base: string, id: string, offset: number, bytes: Buffer) =>
  send(`${base}/uploads/${id}?offset=${offset}`, "PUT", bytes, "application/octet-stream");

beforeEach(() => { vi.resetModules(); });
afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = null;
});

describe("short video: chunked upload", () => {
  test("three pieces become one Bunny upload of the whole file; the video comes with the last piece", async () => {
    const { base, received } = await start();
    const file = Buffer.from(Array.from({ length: 3000 }, (_, i) => i % 251));
    const { uploadId } = await begin(base, file.length);

    expect(await (await piece(base, uploadId, 0, file.subarray(0, 1000))).json()).toEqual({ received: 1000 });
    expect(await (await piece(base, uploadId, 1000, file.subarray(1000, 2000))).json()).toEqual({ received: 2000 });
    const last = await (await piece(base, uploadId, 2000, file.subarray(2000))).json() as { video: { fileName: string; size: number } };

    expect(received).toHaveLength(1);
    expect(received[0].bytes.equals(file)).toBe(true);
    expect(received[0].url).toMatch(/^https:\/\/storage\.test\/nunta-test\/shortvideo\/Video-Nunta-[a-z0-9]+\.mov$/);
    expect(last.video).toMatchObject({ size: 3000, fileName: received[0].url.split("/").pop() });
  });

  test("a piece at the wrong offset is refused and the upload can't be finished with it", async () => {
    const { base } = await start();
    const { uploadId } = await begin(base, 2000);
    expect((await piece(base, uploadId, 0, Buffer.alloc(1000))).status).toBe(200);
    const skipped = await piece(base, uploadId, 1500, Buffer.alloc(500));
    expect(skipped.status).toBe(409);
    expect(await skipped.json()).toMatchObject({ received: 1000 });
  });

  test("Bunny refusing the file is reported with the last piece", async () => {
    const { base } = await start(401);
    const { uploadId } = await begin(base, 10);
    const response = await piece(base, uploadId, 0, Buffer.alloc(10));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("401") });
  });

  test("large pieces arrive whole (the Bunny side reads slower than the browser sends)", async () => {
    const { base, received } = await start();
    const file = Buffer.alloc(40 * 1024 * 1024);
    for (let i = 0; i < file.length; i += 4096) file[i] = (i / 4096) % 256;
    const { uploadId } = await begin(base, file.length);
    const half = file.length / 2;
    expect((await piece(base, uploadId, 0, file.subarray(0, half))).status).toBe(200);
    const last = await piece(base, uploadId, half, file.subarray(half));
    expect(last.status).toBe(200);
    expect(received[0].bytes.equals(file)).toBe(true);
  }, 30_000);

  test("the page on www can call it on upload.ancavisuals.ro (uploadOriginCors): preflight answered, other sites get nothing", async () => {
    const { base } = await start();
    const preflight = await new Promise<{ status: number; headers: Record<string, unknown> }>((resolve, reject) => {
      const req = request(`${base}/uploads/abc`, { method: "OPTIONS", headers: { Origin: "https://www.ancavisuals.ro", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type" } }, (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
      });
      req.on("error", reject);
      req.end();
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("https://www.ancavisuals.ro");
    expect(String(preflight.headers["access-control-allow-headers"])).toContain("authorization");
    expect(String(preflight.headers["access-control-allow-methods"])).toContain("PUT");
  });

  test("a request from another site gets no CORS headers", async () => {
    const { base } = await start();
    const answer = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const req = request(`${base}/uploads/abc`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" } }, (res) => { res.resume(); resolve(res.headers); });
      req.on("error", reject);
      req.end();
    });
    expect(answer["access-control-allow-origin"]).toBeUndefined();
  });
});
