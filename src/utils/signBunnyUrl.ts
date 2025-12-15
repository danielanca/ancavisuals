import crypto from "crypto";

export function signBunnyUrl(path: string) {
  const cdnBase = process.env.BUNNY_CDN_DOMAIN!;
  const securityKey = process.env.BUNNY_API_KEY!;

  const expires = Math.floor(Date.now() / 1000) + 3600; // 1h

  const hash = crypto
    .createHash("sha256")
    .update(securityKey + path + expires)
    .digest("hex");

  return `${cdnBase}${path}?token=${hash}&expires=${expires}`;
}
