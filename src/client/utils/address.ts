const DEFAULT_APP_PORT = 1994;
const PROD_ORIGIN = "https://ancavisuals.ro";
const LOCAL_ORIGIN = `http://localhost:${DEFAULT_APP_PORT}`;

export const isProd = import.meta.env.PROD;
export const thePORT = DEFAULT_APP_PORT;
export const remoteAddress = PROD_ORIGIN;
export const remoteAddressLocal = LOCAL_ORIGIN;
export const destination: string = isProd ? PROD_ORIGIN : LOCAL_ORIGIN;
