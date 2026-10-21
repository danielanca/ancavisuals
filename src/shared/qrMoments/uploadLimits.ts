// Keep this aligned with nginx's production `client_max_body_size 1000m`
// on upload.ancavisuals.ro. Uploads are sent one file per request, so this
// is a per-file limit, not a combined limit for the whole selection.
export const MAX_UPLOAD_FILE_SIZE_MB = 1000;
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

// A written wish ("✍️ Urare") is stored as text in Firestore, not as a file.
export const MAX_WISH_LENGTH = 1500;
