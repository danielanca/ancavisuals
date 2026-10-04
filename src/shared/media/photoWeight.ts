// One photo-weight rule for the whole public site (offer landings, homepage, media
// footer): photos over this are not shown to visitors — they slow phones down — and
// the admin sees them flagged instead, to replace them with a lighter file.
export const MAX_PHOTO_BYTES = 350 * 1024;

export const isHeavyPhoto = (bytes: number | undefined) => (bytes ?? 0) > MAX_PHOTO_BYTES;

export const formatPhotoWeight = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString("ro-RO", { maximumFractionDigits: 1 })} MB`
    : `${Math.round(bytes / 1024)} KB`;

/** The admin's note on a flagged photo. */
export const heavyPhotoNote = (bytes: number) =>
  `⚠️ ${formatPhotoWeight(bytes)} — prea mare, ascunsă pentru vizitatori (max ${MAX_PHOTO_BYTES / 1024} KB)`;
