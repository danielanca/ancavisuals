const DEFAULT_APP_PORT = 1994;
const PROD_ORIGIN = "https://ancavisuals.ro";
const LOCAL_ORIGIN = `http://localhost:${DEFAULT_APP_PORT}`;

export const DOMAIN = "ancavisuals.ro";
export const WWW_ORIGIN = "https://www.ancavisuals.ro";
export const isProd = import.meta.env.PROD;
export const thePORT = DEFAULT_APP_PORT;
export const remoteAddress = PROD_ORIGIN;
export const remoteAddressLocal = LOCAL_ORIGIN;
export const destination: string = isProd ? PROD_ORIGIN : LOCAL_ORIGIN;

// Subdomeniu DNS-only în Cloudflare (nu trece prin proxy-ul portocaliu), folosit
// doar pentru upload-uri mari (ex: video QR Moments) ca să ocolească plafonul
// de 100MB pe care Cloudflare îl impune peste tot altundeva pe domeniul principal.
export const UPLOAD_ORIGIN: string = isProd ? "https://upload.ancavisuals.ro" : LOCAL_ORIGIN;
