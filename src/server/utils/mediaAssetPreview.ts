import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";
import { shrinkPhoto } from "./shrinkPhoto";

/** Store an independent WebP beside a Media Asset, without changing its original. */
export async function createMediaAssetPreview(buffer: Buffer, contentType: string, bunnyPath: string) {
  const preview = await shrinkPhoto(buffer, contentType, true);
  if (!preview.shrunk) return {};
  const previewBunnyPath = bunnyPath.replace(/\.[^/.]+$/, "") + ".preview.webp";
  const response = await fetch(buildBunnyStorageUrl(previewBunnyPath), {
    method: "PUT",
    headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey(), "Content-Type": "image/webp" },
    body: preview.buffer,
  });
  if (!response.ok) throw new Error(`Bunny preview upload failed: ${response.status}`);
  const previewUrl = `${(process.env.BUNNY_CDN_DOMAIN ?? "").replace(/\/$/, "")}/${previewBunnyPath}`;
  return { previewBunnyPath, previewUrl, displayUrl: previewUrl };
}
