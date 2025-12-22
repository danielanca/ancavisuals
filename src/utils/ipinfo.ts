import type { Request } from "express";

export type IpInfo = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  timezone?: string;
  hostname?: string;
};

export const getClientIp = (request: Request): string => {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0].trim();
  }

  const ip = request.ip ?? "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

export const fetchIpInfo = async (ip: string): Promise<IpInfo | null> => {
  const token = process.env.IPINFO_TOKEN;

  if (!token) return null;
  if (!ip || ip === "::1" || ip === "127.0.0.1") return null;

  const url = `https://ipinfo.io/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) return null;

  return (await res.json()) as IpInfo;
};
