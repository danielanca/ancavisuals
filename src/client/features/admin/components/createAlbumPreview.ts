export const PREVIEW_TIMEOUT_MS = 20_000;

export function createAlbumPreview(file: File, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Upload anulat"));
    const worker = new Worker(new URL("./albumPreview.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const fail = (reason: string) => { cleanup(); reject(new Error(reason)); };
    const abort = () => fail("Upload anulat");
    // A camera JPG encodes in 1–3 s; 20 s means something is wrong — say so, don't wait a minute.
    const timer = setTimeout(() => fail("generarea a durat peste 20 de secunde"), PREVIEW_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => fail("browserul nu a putut porni generatorul de WebP");
    worker.onmessage = (event: MessageEvent<{ blob?: Blob }>) => {
      cleanup();
      if (event.data.blob?.type === "image/webp") resolve(event.data.blob);
      else reject(new Error("browserul nu poate face WebP din această poză"));
    };
    try { worker.postMessage(file); } catch { fail("poza nu a putut fi trimisă generatorului"); }
  });
}
