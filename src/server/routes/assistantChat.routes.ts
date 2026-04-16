import { Router } from "express";
import type { ChatNode } from "../data/assistantChatData";
import { CHAT_NODES, FALLBACK_NODE } from "../data/assistantChatData";
import { firestore } from "../firestore";
import { expandEventDates } from "../utils/expandEventDates";
import { sendEmail } from "../notifications/mailer";
import { adminUser } from "../constants/credentials";
import { renderChatbotLeadTemplate } from "../notifications/templates/chatbotLeadTemplate";
import { renderDateCheckTemplate } from "../notifications/templates/dateCheckTemplate";

/** ============================================================
 *  CONSTANTS
 * ============================================================ */
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MIN_VALID_YEAR = 2024;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_DAY = 1;
const MAX_DAY = 31;

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function parseDate(input: string): string | null {
  const datePartsMatch = input.trim().match(DATE_RE);
  if (!datePartsMatch) return null;

  const dayNumber = parseInt(datePartsMatch[1]);
  const monthNumber = parseInt(datePartsMatch[2]);
  const yearNumber = parseInt(datePartsMatch[3]);

  if (
    monthNumber < MIN_MONTH
    || monthNumber > MAX_MONTH
    || dayNumber < MIN_DAY
    || dayNumber > MAX_DAY
    || yearNumber < MIN_VALID_YEAR
  ) {
    return null;
  }

  return `${yearNumber}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
}

async function getBookedDates(): Promise<string[]> {
  try {
    const db = firestore();
    const snapshot = await db.collection("adminEvents").get();
    const confirmed = new Set(["confirmat", "finalizat"]);
    const dates: string[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!confirmed.has(data.status)) continue;
      dates.push(...expandEventDates(data));
    }

    return dates;
  } catch (error) {
    console.error("[assistant] getBookedDates failed:", error);
    return [];
  }
}

const router = Router();

router.get("/init", (_req, res) => {
  res.json(CHAT_NODES.get("welcome") ?? FALLBACK_NODE);
});

router.post("/message", async (req, res) => {
  const { intentId, text, phone, date } = req.body as { intentId?: string; text?: string; phone?: string; date?: string };

  // Phone number submitted explicitly from the frontend
  if (phone) {
    const dateLabel = date
      ? (() => {
          const [yearNumber, monthNumber, dayNumber] = date.split("-");
          return `${parseInt(dayNumber)} ${MONTHS_RO[parseInt(monthNumber) - 1]} ${yearNumber}`;
        })()
      : "nedefinită";

    sendEmail({
      to: adminUser.email,
      subject: `📞 Lead nou prin chatbot — ${phone}`,
      html: renderChatbotLeadTemplate({ phone, dateLabel }),
    }).then(() => {
      console.log(`[chatbot] lead email sent for ${phone}`);
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

    // Check date availability (format DD/MM/YYYY)
    const dateKey = parseDate(text.trim());
    if (dateKey) {
      const bookedDates = await getBookedDates();
      const [yearNumber, monthNumber, dayNumber] = dateKey.split("-");
      const humanDate = `${parseInt(dayNumber)} ${MONTHS_RO[parseInt(monthNumber) - 1]} ${yearNumber}`;
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

      // Send notification email (fire-and-forget, does not block the response)
      sendEmail({
        to: adminUser.email,
        subject: `📅 Verificare disponibilitate: ${humanDate}`,
        html: renderDateCheckTemplate({ humanDate, isBooked }),
      }).then(() => {
        console.log(`[chatbot] availability email sent for ${humanDate}`);
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
