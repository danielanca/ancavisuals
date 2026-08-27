// Keep this aligned with nginx's production `client_max_body_size 500m`.
// Uploads are sent one file per request, so this is a per-file limit, not a
// combined limit for the whole selection.
export const MAX_UPLOAD_FILE_SIZE_MB = 500;
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
