import { Router } from "express";
import { CHAT_NODES, FALLBACK_NODE, ChatNode } from "../data/assistantChatData";
import { getStorage } from "firebase-admin/storage";
import { firestore } from "../firestoreInit";
import nodemailer from "nodemailer";
import { transportOptions } from "../constants/emailCons";
import { adminUser, emailAuth } from "../constants/credentials";

const mailer = nodemailer.createTransport(transportOptions);

/** ============================================================
 *  CONSTANTE
 * ============================================================ */
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const FIREBASE_BUCKET = "joculdetectivului.appspot.com";
const BOOKED_DATES_FILE = "ancavisuals/bookedDates/bookedDates.json";
const MIN_VALID_YEAR = 2024;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_DAY = 1;
const MAX_DAY = 31;

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function parseDate(input: string): string | null {
  const m = input.trim().match(DATE_RE);
  if (!m) return null;
  const d = parseInt(m[1]), mo = parseInt(m[2]), y = parseInt(m[3]);
  if (mo < MIN_MONTH || mo > MAX_MONTH || d < MIN_DAY || d > MAX_DAY || y < MIN_VALID_YEAR) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function getBookedDates(): Promise<string[]> {
  try {
    firestore();
    const bucket = getStorage().bucket(FIREBASE_BUCKET);
    const [contents] = await bucket.file(BOOKED_DATES_FILE).download();
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

const PHONE_RE = /^[+]?[\d\s\-().]{7,15}$/;

const router = Router();

router.get("/init", (_req, res) => {
  res.json(CHAT_NODES.get("welcome") ?? FALLBACK_NODE);
});

router.post("/message", async (req, res) => {
  const { intentId, text, phone, date } = req.body as { intentId?: string; text?: string; phone?: string; date?: string };

  // Număr de telefon trimis explicit din frontend
  if (phone) {
    const dateLabel = date
      ? (() => {
          const [y, mo, d] = date.split("-");
          return `${parseInt(d)} ${MONTHS_RO[parseInt(mo) - 1]} ${y}`;
        })()
      : "nedefinită";

    mailer.sendMail({
      from: emailAuth.email,
      to: adminUser.email,
      subject: `📞 Lead nou prin chatbot — ${phone}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:8px">
          <h2 style="margin:0 0 16px;color:#111">Lead nou prin chatbot</h2>
          <p style="margin:0 0 8px;color:#444">Un vizitator și-a lăsat numărul de telefon:</p>
          <div style="font-size:22px;font-weight:700;color:#111;padding:12px 16px;background:#fff;border-left:4px solid #22c55e;border-radius:4px;margin-bottom:16px">
            ${phone}
          </div>
          <p style="margin:0;color:#444">Data de interes: <strong>${dateLabel}</strong></p>
        </div>
      `,
    }).then(() => {
      console.log(`[chatbot] email lead trimis pentru ${phone}`);
    }).catch((err: Error) => {
      console.error("[chatbot] email lead failed:", err.message);
    });

    return res.json(CHAT_NODES.get("phone_confirmed") ?? FALLBACK_NODE);
  }

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
      const humanDate = `${parseInt(d)} ${MONTHS_RO[parseInt(mo) - 1]} ${y}`;
      const isBooked = bookedDates.includes(dateKey);
      const node: ChatNode = isBooked
        ? {
            id: "data_ocupata",
            botMessage: `Ne pare rău, data de **${humanDate}** este deja rezervată. 😔\nTe rugăm să alegi o altă dată.`,
            suggestions: [
              { label: "Verifică altă dată", intentId: "check_date" },
              { label: "Alte întrebări", intentId: "welcome" },
            ],
          }
        : {
            id: "date_available",
            botMessage: `✅ Data de **${humanDate}** este disponibilă!\n\nPoți lăsa numărul tău de telefon și te contactăm noi, sau deschide formularul pentru a configura pachetul.`,
            suggestions: [
              { label: "📞 Lasă numărul tău", intentId: "leave_phone" },
              { label: "Deschide formularul →", intentId: "link_contact" },
              { label: "Verifică altă dată", intentId: "check_date" },
            ],
          };

      // Trimite notificare email (fire-and-forget, nu blochează răspunsul)
      mailer.sendMail({
        from: emailAuth.email,
        to: adminUser.email,
        subject: `📅 Verificare disponibilitate: ${humanDate}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:8px">
            <h2 style="margin:0 0 16px;color:#111">Verificare disponibilitate prin chatbot</h2>
            <p style="margin:0 0 8px;color:#444">Un vizitator a verificat disponibilitatea pentru data:</p>
            <div style="font-size:22px;font-weight:700;color:#111;padding:12px 16px;background:#fff;border-left:4px solid #f4d067;border-radius:4px;margin-bottom:16px">
              ${humanDate}
            </div>
            <p style="margin:0;color:#444">
              Status: <strong style="color:${isBooked ? "#e04444" : "#22c55e"}">${isBooked ? "❌ Ocupată" : "✅ Disponibilă"}</strong>
            </p>
          </div>
        `,
      }).then(() => {
        console.log(`[chatbot] email notificare trimis pentru data ${humanDate}`);
      }).catch((err: Error) => {
        console.error("[chatbot] email notify failed:", err.message);
      });

      return res.json(node);
    }

    if (/fotocabin|photo.?booth/.test(lower)) {
      return res.json(CHAT_NODES.get("photobooth_pricing") ?? FALLBACK_NODE);
    }
    if (/pret|cost|cat cost|pachet|tarif/.test(lower)) {
      return res.json(CHAT_NODES.get("pricing") ?? FALLBACK_NODE);
    }
    if (/nunta|botez|logodna|cununie|eveniment|servicii|fotografiez|filmez/.test(lower)) {
      return res.json(CHAT_NODES.get("services") ?? FALLBACK_NODE);
    }
    if (/rezerv|disponibil|data|cand/.test(lower)) {
      return res.json(CHAT_NODES.get("booking") ?? FALLBACK_NODE);
    }
    if (/livr|termen|cand primesc|galerie|album/.test(lower)) {
      return res.json(CHAT_NODES.get("delivery") ?? FALLBACK_NODE);
    }
    if (/zona|deplasare|bucuresti|oras|unde lucr/.test(lower)) {
      return res.json(CHAT_NODES.get("coverage") ?? FALLBACK_NODE);
    }
    if (/cum|proces|functioneaz|pasi|etape/.test(lower)) {
      return res.json(CHAT_NODES.get("process") ?? FALLBACK_NODE);
    }
  }

  return res.json(FALLBACK_NODE);
});

export default router;
