// Phone videos routinely exceed a couple hundred MB (4K recordings especially) —
// keep this generous, but capped, since the server buffers each upload fully in
// memory (multer memoryStorage) before relaying it to Bunny.
export const MAX_UPLOAD_FILE_SIZE_MB = 500;
export const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;
