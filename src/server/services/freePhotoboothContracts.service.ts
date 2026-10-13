import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";

/** Public projection only: never send contract IDs, tokens or full client names. */
export async function getFreePhotoboothContracts() {
  const snapshot = await firestore().collection("contracts").where("status", "==", "signed")
    .select("status", "clientType", "privateClient", "clientName", "clientCity", "signedAt", "services").get();
  return snapshot.docs.flatMap(doc => {
    const data = doc.data();
    if (data.status !== "signed" || data.clientType === "PJ" || data.privateClient === true) return [];
    const services = Array.isArray(data.services) ? data.services : [];
    const hasFreeBooth = services.some((service: unknown) => {
      if (!service || typeof service !== "object") return false;
      const s = service as Record<string, unknown>;
      const label = typeof s.label === "string"
        ? s.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
      return /fotocabin|photo\s*booth/.test(label) && s.gratuit === true;
    });
    if (!hasFreeBooth || typeof data.clientName !== "string" || !data.clientName.trim()) return [];
    const date = data.signedAt instanceof Timestamp ? data.signedAt.toDate()
      : typeof data.signedAt === "string" ? new Date(data.signedAt) : null;
    if (!date || !Number.isFinite(date.getTime())) return [];
    const maskedName = data.clientName.trim().split(/\s+/).map(word => {
      const letters = Array.from(word);
      return letters.slice(0, Math.min(2, letters.length - 1)).join("") + "*".repeat(Math.max(1, letters.length - 2));
    }).join(" ");
    return [{ maskedName, city: typeof data.clientCity === "string" ? data.clientCity.trim() : "", signedAt: date.toISOString() }];
  }).sort((a, b) => b.signedAt.localeCompare(a.signedAt));
}
