import { ALBUM_PREVIEW_MAX_WIDTH } from "../../../../shared/albumPreview";

export async function encodeAlbumPreview(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const width = Math.min(ALBUM_PREVIEW_MAX_WIDTH, bitmap.width);
    const height = Math.max(1, Math.round(bitmap.height * width / bitmap.width));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponibil");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.72 });
    if (blob.type !== "image/webp" || !blob.size) throw new Error("WebP indisponibil");
    return blob;
  } finally {
    bitmap.close();
  }
}
