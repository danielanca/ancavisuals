export interface GeoResult {
  city: string;
  country: string;
  countryCode: string;
  flag: string;
}

// Geolocalizare IP prin ipwho.is (gratuit, fără API key). Best-effort: orice
// eșec (rețea, rate-limit, IP local) se întoarce ca rezultat "necunoscut"
// în loc să arunce, ca apelantul să poată continua fără geolocalizare.
export async function geolocateIp(ip: string): Promise<GeoResult> {
  try {
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.");
    if (isLocal) return { city: "Local", country: "Rețea locală", countryCode: "", flag: "🏠" };

    const response = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json() as {
      success?: boolean;
      city?: string;
      country?: string;
      country_code?: string;
      flag?: { emoji?: string };
    };

    if (data.success && data.city) {
      return {
        city: data.city,
        country: data.country ?? "",
        countryCode: data.country_code ?? "",
        flag: data.flag?.emoji ?? "",
      };
    }
  } catch {
    // geolocation failed, continue without it
  }
  return { city: "Necunoscut", country: "", countryCode: "", flag: "🌍" };
}
