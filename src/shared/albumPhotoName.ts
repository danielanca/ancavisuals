export const sanitizeAlbumPhotoName = (raw: string): string => raw
  .replace(/^.*[/\\]/, "")
  .replace(/[^a-zA-Z0-9._-]/g, "_")
  .replace(/_{2,}/g, "_")
  .slice(-128);
