import { encodeAlbumPreview } from "./albumPreviewEncoding";

// One image per worker; the uploader bounds the number of active workers.
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    self.postMessage({ blob: await encodeAlbumPreview(event.data) });
  } catch {
    self.postMessage({ error: "Nu s-a putut genera previzualizarea local." });
  }
};
