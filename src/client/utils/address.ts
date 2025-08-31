export const isProd = process.env.NODE_ENV === 'production';
export const thePORT = isProd ? 1994 : 1994;
export const remoteAddress = 'https://ancavisuals.ro';
export const remoteAddressLocal = `http://localhost:${thePORT}`;
export let destination: string = isProd ? 'https://ancavisuals.ro' : remoteAddressLocal;
