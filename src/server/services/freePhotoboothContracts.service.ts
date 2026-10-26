import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";

/** Free photo booth / videobooth promo: how many weddings get it (5 → 10 on 2026-10-26, owner: „încă pentru 5 persoane”). The landing page shows the remaining slots from this. */
export const FREE_PHOTOBOOTH_SLOTS = 10;

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
      // The couple picks one gift: the photo booth or the videobooth (360).
      return /fotocabin|photo\s*booth|video\s*(booth|cabina)|360/.test(label) && s.gratuit === true;
    });
    if (!hasFreeBooth || typeof data.clientName !== "string" || !data.clientName.trim()) return [];
    const date = data.signedAt instanceof Timestamp ? data.signedAt.toDate()
      : typeof data.signedAt === "string" ? new Date(data.signedAt) : null;
    if (!date || !Number.isFinite(date.getTime())) return [];
    const maskedName = data.clientName.trim().split(/\s+/).map(word => {
      const letters = Array.from(word);
      // Over 4 letters: the last one shows too (Bo***n), so similar names are easier to tell apart.
      if (letters.length > 4) return letters.slice(0, 2).join("") + "*".repeat(letters.length - 3) + letters[letters.length - 1];
      return letters.slice(0, Math.min(2, letters.length - 1)).join("") + "*".repeat(Math.max(1, letters.length - 2));
    }).join(" ");
    return [{ maskedName, city: typeof data.clientCity === "string" ? data.clientCity.trim() : "", signedAt: date.toISOString() }];
  }).sort((a, b) => b.signedAt.localeCompare(a.signedAt));
}
