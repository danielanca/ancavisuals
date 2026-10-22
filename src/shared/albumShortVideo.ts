/*
 * Purpose: the album's uploaded "Video scurt" file, stored in Bunny at {slug}/shortvideo/<name>.
 * Shared so the admin uploader rejects exactly what the server would reject, before sending GBs.
 */

export const SHORT_VIDEO_FOLDER = "shortvideo";
export const SHORT_VIDEO_MAX_BYTES = 4 * 1024 * 1024 * 1024;
/** One piece of a chunked upload: Cloudflare (in front of the site) refuses requests over 100 MB. */
export const SHORT_VIDEO_CHUNK_BYTES = 50 * 1024 * 1024;
export const SHORT_VIDEO_ACCEPT = ".mp4,.mov,.m4v,.webm,video/mp4,video/quicktime,video/webm";

const EXTENSIONS: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** Bunny Stream copy for adaptive playback; null = Stream not configured → plain <video> on the original. */
export type AlbumShortVideoStream = { status: "processing" | "ready" | "failed"; embedUrl: string | null; hlsUrl?: string | null };
export type AlbumShortVideo = { fileName: string; size: number | null; url: string; stream?: AlbumShortVideoStream | null };

/** Bunny-safe file name ("Video Nuntă 2026.MOV" → "Video-Nunta-2026.mov"); null = not a supported video. */
export function sanitizeShortVideoName(raw: string): string | null {
  const name = String(raw ?? "").split(/[\\/]/).pop() ?? "";
  const match = /^(.*)\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match) return null;
  const ext = match[2].toLowerCase();
  if (!EXTENSIONS[ext]) return null;
  const base = match[1]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${base || "video-scurt"}.${ext}`;
}

export function shortVideoContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONS[ext] ?? "application/octet-stream";
}

/** Placeholders like `.keep` (created with the album folders) are not the video. */
export function isShortVideoObject(entry: { ObjectName: string; IsDirectory?: boolean }): boolean {
  return !entry.IsDirectory && !entry.ObjectName.startsWith(".");
}
