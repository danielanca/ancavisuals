import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { shrinkPhoto, thumbPhoto } from "./shrinkPhoto";

async function putWebp(path: string, body: Buffer) {
  const response = await fetch(buildBunnyStorageUrl(path), {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": "image/webp" },
    body,
  });
  if (!response.ok) throw new Error(`Bunny preview upload failed: ${response.status}`);
  return `${(process.env.BUNNY_CDN_DOMAIN ?? "").replace(/\/$/, "")}/${path}`;
}

type MediaAssetThumb = { thumbBunnyPath?: string; thumbUrl?: string };
type MediaAssetPreview = MediaAssetThumb & { previewBunnyPath?: string; previewUrl?: string; displayUrl?: string };

/** A small `.thumb.webp` beside a Media Asset, only for galleries; `{}` when the file is not a readable photo. */
export async function createMediaAssetThumb(buffer: Buffer, bunnyPath: string): Promise<MediaAssetThumb> {
  const thumb = await thumbPhoto(buffer);
  if (!thumb) return {};
  const thumbBunnyPath = bunnyPath.replace(/\.[^/.]+$/, "").replace(/\.preview$/, "") + ".thumb.webp";
  return { thumbBunnyPath, thumbUrl: await putWebp(thumbBunnyPath, thumb) };
}

/** Store an independent WebP (+ a gallery thumbnail) beside a Media Asset, without changing its original. */
export async function createMediaAssetPreview(buffer: Buffer, contentType: string, bunnyPath: string): Promise<MediaAssetPreview> {
  const preview = await shrinkPhoto(buffer, contentType, true);
  if (!preview.shrunk) return {};
  const previewBunnyPath = bunnyPath.replace(/\.[^/.]+$/, "") + ".preview.webp";
  const previewUrl = await putWebp(previewBunnyPath, preview.buffer);
  // From the 1600 px preview: same picture, much less to decode than the camera original.
  const thumb = await createMediaAssetThumb(preview.buffer, bunnyPath);
  return { previewBunnyPath, previewUrl, displayUrl: previewUrl, ...thumb };
}
