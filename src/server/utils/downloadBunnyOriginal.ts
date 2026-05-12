import { BUNNY_ACCESS_KEY_HEADER, buildBunnyStorageUrl, getBunnyStorageKey } from "../constants/bunny";

export async function downloadBunnyOriginal(cdnUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const cdnDomain = (process.env.BUNNY_CDN_DOMAIN ?? "").replace(/\/$/, "");

  if (cdnDomain && cdnUrl.startsWith(cdnDomain)) {
    try {
      const pathname = new URL(cdnUrl).pathname;
      const segments = pathname.split("/").filter(Boolean);
      const previewIndex = segments.indexOf("photos_preview");

      if (previewIndex !== -1) {
        const originalSegments = [...segments];
        originalSegments[previewIndex] = "photos";
        const last = originalSegments[originalSegments.length - 1];
        const baseName = last.replace(/\.[^.]+$/, "");
        const namesToTry = Array.from(new Set([last, `${baseName}.jpg`, `${baseName}.jpeg`, `${baseName}.JPG`, `${baseName}.JPEG`, `${baseName}.png`]));

        for (const name of namesToTry) {
          const trySegments = [...originalSegments];
          trySegments[trySegments.length - 1] = name;
          const storageResponse = await fetch(buildBunnyStorageUrl(...trySegments), {
            headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
          });
          if (storageResponse.ok) {
            return {
              buffer: Buffer.from(await storageResponse.arrayBuffer()),
              contentType: storageResponse.headers.get("content-type") ?? "image/jpeg",
            };
          }
        }
      }

      const storageResponse = await fetch(buildBunnyStorageUrl(...segments), {
        headers: { [BUNNY_ACCESS_KEY_HEADER]: getBunnyStorageKey() },
      });
      if (storageResponse.ok) {
        return {
          buffer: Buffer.from(await storageResponse.arrayBuffer()),
          contentType: storageResponse.headers.get("content-type") ?? "image/jpeg",
        };
      }
    } catch {
      // fall through
    }
  }

  const fallbackUrl = `${cdnUrl.split("?")[0]}`;
  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`Download esuat: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/jpeg",
  };
}
