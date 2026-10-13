export function createAlbumPreview(file: File, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Upload anulat"));
    const worker = new Worker(new URL("./albumPreview.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const fail = () => { cleanup(); reject(new Error("Previzualizare locală indisponibilă")); };
    const abort = () => fail();
    const timer = setTimeout(fail, 60_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = fail;
    worker.onmessage = (event: MessageEvent<{ blob?: Blob }>) => {
      cleanup();
      if (event.data.blob?.type === "image/webp") resolve(event.data.blob);
      else reject(new Error("WebP indisponibil"));
    };
    try { worker.postMessage(file); } catch { fail(); }
  });
}
