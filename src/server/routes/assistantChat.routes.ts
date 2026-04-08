import { Router } from "express";
import { CHAT_NODES, FALLBACK_NODE, ChatNode } from "../data/assistantChatData";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestoreInit";

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function parseDate(input: string): string | null {
  const m = input.trim().match(DATE_RE);
  if (!m) return null;
  const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2024) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function getBookedDates(): Promise<string[]> {
  try {
    firestore(); // asigură inițializarea Firebase Admin
    const bucket = getStorage().bucket("joculdetectivului.appspot.com");
    const [contents] = await bucket.file("ancavisuals/bookedDates/bookedDates.json").download();
    const data = JSON.parse(contents.toString());
    const set = new Set<string>();
    for (const entry of data?.dates ?? []) {
      if ("date" in entry && entry.date) {
        set.add(entry.date);
      } else if ("startDate" in entry && "endDate" in entry) {
        const cur = new Date(entry.startDate);
        const end = new Date(entry.endDate);
        while (cur <= end) {
          set.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return Array.from(set);
  } catch (e) {
    console.error("[assistant] getBookedDates failed:", e);
    return [];
  }
}

const router = Router();

router.get("/init", (_req, res) => {
  res.json(CHAT_NODES.get("welcome") ?? FALLBACK_NODE);
});

router.post("/message", async (req, res) => {
  const { intentId, text } = req.body as { intentId?: string; text?: string };

  if (intentId) {
    const node = CHAT_NODES.get(intentId);
    if (node) return res.json(node);
  }

  if (text) {
    const lower = text.toLowerCase();

    // Verificare disponibilitate dată (format ZZ/LL/AAAA)
    const dateKey = parseDate(text.trim());
    if (dateKey) {
      const bookedDates = await getBookedDates();
      const [y, mo, d] = dateKey.split("-");
      const months = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
      const humanDate = `${parseInt(d)} ${months[parseInt(mo) - 1]} ${y}`;
      const node: ChatNode = bookedDates.includes(dateKey)
        ? {
            id: "data_ocupata",
            botMessage: `Ne pare rău, data de **${humanDate}** este deja rezervată. 😔\nTe rugăm să alegi o altă dată.`,
            suggestions: [
              { label: "Verifică altă dată", intentId: "verificare_data" },
              { label: "Alte întrebări", intentId: "welcome" },
            ],
          }
        : {
            id: "data_disponibila",
            botMessage: `✅ Data de **${humanDate}** este disponibilă!\n\nPoți continua cu rezervarea din formularul nostru.`,
            suggestions: [
              { label: "Verifică altă dată", intentId: "verificare_data" },
              { label: "Deschide formularul →", intentId: "link_contact" },
              { label: "Alte întrebări", intentId: "welcome" },
            ],
          };
      return res.json(node);
    }

    if (/fotocabin|photo.?booth/.test(lower)) {
      return res.json(CHAT_NODES.get("pret_fotocabina") ?? FALLBACK_NODE);
    }
    if (/pret|cost|cat cost|pachet|tarif/.test(lower)) {
      return res.json(CHAT_NODES.get("pret") ?? FALLBACK_NODE);
    }
    if (/nunta|botez|logodna|cununie|eveniment|servicii|fotografiez|filmez/.test(lower)) {
      return res.json(CHAT_NODES.get("servicii") ?? FALLBACK_NODE);
    }
    if (/rezerv|disponibil|data|cand/.test(lower)) {
      return res.json(CHAT_NODES.get("rezervare") ?? FALLBACK_NODE);
    }
    if (/livr|termen|cand primesc|galerie|album/.test(lower)) {
      return res.json(CHAT_NODES.get("livrare") ?? FALLBACK_NODE);
    }
    if (/zona|deplasare|bucuresti|oras|unde lucr/.test(lower)) {
      return res.json(CHAT_NODES.get("zona") ?? FALLBACK_NODE);
    }
    if (/cum|proces|functioneaz|pasi|etape/.test(lower)) {
      return res.json(CHAT_NODES.get("proces") ?? FALLBACK_NODE);
    }
  }

  return res.json(FALLBACK_NODE);
});

export default router;
