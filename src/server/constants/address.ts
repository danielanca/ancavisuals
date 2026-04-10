export const isProd = process.env.NODE_ENV === "production";
export const thePORT = isProd ? 7600 : 7600;
export const remoteAddress = "https://diniubire.ro";
export const remoteAddressLocal = `http://localhost:${thePORT}`;
export const destination: string = isProd ? "https://diniubire.ro" : remoteAddressLocal;
