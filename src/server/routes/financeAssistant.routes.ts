import { createAnthropicClient } from "../lib/anthropicClient";
import { Router } from "express";
import type { Request, Response } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import { getBnrYearRates } from "../services/bnrExchangeRate.service";

// Asistent AI pentru zona Financiar. Spre deosebire de asistentul generic (care vede doar
// rezumatul text trimis de pagină), acesta are unelte read-only peste Firestore: facturi,
// cheltuieli, tranzacții din extrase și evenimente. Pagina trimite în `context` doar cifrele
// calculate pe ecran (taxe, proiecție), ca răspunsurile să se potrivească cu ce vede omul.
const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);
const anthropic = createAnthropicClient("Asistent financiar", { apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 });

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;
const MAX_ROWS = 200;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Row = Record<string, unknown>;

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { role: unknown; content: unknown } => item !== null && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: typeof item.content === "string" ? item.content.slice(0, 4000) : "",
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-20);
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function includesText(haystack: unknown, needle: string): boolean {
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return normalize(String(haystack ?? "")).includes(normalize(needle));
}

function yearRange(year: number, month?: number) {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);
  return { start, end };
}

// Curs BNR EUR→RON pe zi; pentru weekend/sărbători folosește ultima zi lucrătoare dinainte.
async function eurConverter(year: number) {
  let rates: Record<string, number> = {};
  try {
    rates = await getBnrYearRates(year, "EUR");
  } catch (error) {
    console.warn("[finance-assistant] BNR rates unavailable:", error);
  }
  const dates = Object.keys(rates).sort();
  const fallback = dates.length > 0 ? rates[dates[dates.length - 1]] : 5;
  return (amount: number, currency: string, iso: string | null): number | null => {
    if (currency === "RON") return amount;
    if (currency !== "EUR") return null;
    const day = (iso ?? "").slice(0, 10);
    let rate = fallback;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= day) { rate = rates[dates[i]]; break; }
    }
    return amount * rate;
  };
}

function summarize(rows: Row[], amountKey: string, extra: Record<string, unknown> = {}) {
  const byCurrency: Record<string, number> = {};
  let ron = 0;
  let unconverted = 0;
  for (const row of rows) {
    const currency = String(row.currency ?? "RON");
    byCurrency[currency] = round2((byCurrency[currency] ?? 0) + Number(row[amountKey] ?? 0));
    if (typeof row.amountRon === "number") ron += row.amountRon;
    else unconverted += 1;
  }
  return {
    count: rows.length,
    totalRon: round2(ron),
    byCurrency,
    ...(unconverted > 0 ? { unconvertedCount: unconverted, unconvertedNote: "Rânduri în altă monedă decât RON/EUR, neincluse în totalRon." } : {}),
    ...extra,
    truncated: rows.length > MAX_ROWS,
    rows: rows.slice(0, MAX_ROWS),
  };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_invoices",
    description: "Facturile emise (încasări) dintr-un an, opțional dintr-o lună, filtrate după client sau neîncasate. Întoarce totaluri (convertite în RON la cursul BNR din ziua facturii) și rândurile.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "integer" },
        month: { type: "integer", minimum: 1, maximum: 12 },
        client: { type: "string", description: "Fragment din numele clientului" },
        unpaid_only: { type: "boolean" },
      },
      required: ["year"],
    },
  },
  {
    name: "list_expenses",
    description: "Cheltuielile dintr-un an, opțional dintr-o lună, categorie sau furnizor. Categorii: combustibil, echipament, transport, software, cazare, alimentatie, marketing, altele. Întoarce totaluri (total și deductibil, în RON) și rândurile.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "integer" },
        month: { type: "integer", minimum: 1, maximum: 12 },
        category: { type: "string" },
        supplier: { type: "string", description: "Fragment din numele furnizorului sau descriere" },
      },
      required: ["year"],
    },
  },
  {
    name: "list_bank_transactions",
    description: "Tranzacțiile din extrasele bancare încărcate pentru un an. Fiecare are direcție (in = încasare, out = plată), contraparte și starea justificării: matched (legată de o factură/cheltuială), review (de verificat), unmatched (fără document). Bun pentru: plăți fără document, cât a intrat pe cont, cheltuieli neînregistrate.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "integer" },
        month: { type: "integer", minimum: 1, maximum: 12 },
        direction: { type: "string", enum: ["in", "out"] },
        status: { type: "string", enum: ["matched", "review", "unmatched"] },
        account: { type: "string" },
        search: { type: "string", description: "Fragment din contraparte sau descriere" },
      },
      required: ["year"],
    },
  },
  {
    name: "list_events",
    description: "Evenimentele (nunți, botezuri etc.) cu data, statusul și prețul contractat (EUR), plus cât mai e de încasat. Opțional pe interval de date (YYYY-MM-DD) și status (confirmat, tentativ, anulat etc.).",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string" },
      },
    },
  },
];

type ToolInput = Record<string, unknown>;
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

async function listInvoices(input: ToolInput) {
  const year = num(input.year) ?? new Date().getFullYear();
  const { start, end } = yearRange(year, num(input.month));
  const snapshot = await firestore().collection("invoices")
    .where("date", ">=", Timestamp.fromDate(start)).where("date", "<", Timestamp.fromDate(end)).get();
  const toRon = await eurConverter(year);
  const client = str(input.client);
  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const date = toIso(data.date);
      const amount = Number(data.totalAmount ?? 0);
      const currency = String(data.currency ?? "RON");
      const converted = toRon(amount, currency, date);
      return {
        id: doc.id,
        date: date?.slice(0, 10) ?? null,
        ref: data.invoiceRef ?? `${data.series ?? ""}${data.invoiceNumber ?? ""}`,
        client: data.clientName ?? null,
        type: data.type ?? null,
        amount,
        currency,
        ...(converted != null ? { amountRon: round2(converted) } : {}),
        paid: Boolean(data.paid),
        items: Array.isArray(data.items) ? data.items.map((item: Row) => item.description).filter(Boolean).join("; ").slice(0, 160) : null,
        eventId: data.eventId ?? null,
      } as Row;
    })
    .filter((row) => !client || includesText(row.client, client))
    .filter((row) => !input.unpaid_only || !row.paid)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const unpaidRon = rows.filter((row) => !row.paid).reduce((sum, row) => sum + Number(row.amountRon ?? 0), 0);
  return summarize(rows, "amount", { unpaidRon: round2(unpaidRon) });
}

async function listExpenses(input: ToolInput) {
  const year = num(input.year) ?? new Date().getFullYear();
  const { start, end } = yearRange(year, num(input.month));
  const snapshot = await firestore().collection("expenses")
    .where("date", ">=", Timestamp.fromDate(start)).where("date", "<", Timestamp.fromDate(end)).get();
  const toRon = await eurConverter(year);
  const category = str(input.category);
  const supplier = str(input.supplier);
  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const date = toIso(data.date);
      const amount = Number(data.amount ?? 0);
      const currency = String(data.currency ?? "RON");
      const converted = toRon(amount, currency, date);
      const deductibleConverted = toRon(Number(data.deductibleAmount ?? 0), currency, date);
      return {
        id: doc.id,
        date: date?.slice(0, 10) ?? null,
        supplier: data.supplier ?? null,
        description: data.description ?? null,
        category: data.category ?? null,
        amount,
        currency,
        ...(converted != null ? { amountRon: round2(converted) } : {}),
        ...(deductibleConverted != null ? { deductibleRon: round2(deductibleConverted) } : {}),
        deductibilityPercent: data.deductibility ?? null,
        hasInvoiceDoc: Boolean(data.factura),
        hasReceiptDoc: Boolean(data.chitanta),
      } as Row;
    })
    .filter((row) => !category || row.category === category)
    .filter((row) => !supplier || includesText(row.supplier, supplier) || includesText(row.description, supplier))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const deductibleRon = rows.reduce((sum, row) => sum + Number(row.deductibleRon ?? 0), 0);
  const byCategory: Record<string, { totalRon: number; deductibleRon: number; count: number }> = {};
  for (const row of rows) {
    const key = String(row.category ?? "altele");
    const bucket = byCategory[key] ?? { totalRon: 0, deductibleRon: 0, count: 0 };
    bucket.totalRon = round2(bucket.totalRon + Number(row.amountRon ?? 0));
    bucket.deductibleRon = round2(bucket.deductibleRon + Number(row.deductibleRon ?? 0));
    bucket.count += 1;
    byCategory[key] = bucket;
  }
  const withoutDocument = rows.filter((row) => !row.hasInvoiceDoc && !row.hasReceiptDoc).length;
  return summarize(rows, "amount", { deductibleRon: round2(deductibleRon), byCategory, withoutDocument });
}

async function listBankTransactions(input: ToolInput) {
  const year = num(input.year) ?? new Date().getFullYear();
  const month = num(input.month);
  const snapshot = await firestore().collection("bankStatements").where("year", "==", year).get();
  const toRon = await eurConverter(year);
  const direction = str(input.direction);
  const status = str(input.status);
  const account = str(input.account);
  const search = str(input.search);
  const rows: Row[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const statementAccount = String(data.account || "Cont principal");
    if (account && !includesText(statementAccount, account)) continue;
    const entries = Array.isArray(data.entries) ? data.entries as Row[] : [];
    for (const entry of entries) {
      const date = typeof entry.date === "string" ? entry.date : null;
      if (month && (!date || Number(date.slice(5, 7)) !== month)) continue;
      if (direction && entry.direction !== direction) continue;
      const entryStatus = entry.dismissed ? "dismissed" : String(entry.justificationStatus ?? "unmatched");
      if (status && entryStatus !== status) continue;
      if (search && !includesText(entry.counterparty, search) && !includesText(entry.description, search)) continue;
      const amount = Number(entry.amount ?? 0);
      const currency = String(entry.currency ?? "RON");
      const converted = toRon(amount, currency, date);
      rows.push({
        date: date?.slice(0, 10) ?? null,
        account: statementAccount,
        direction: entry.direction,
        amount,
        currency,
        ...(converted != null ? { amountRon: round2(converted) } : {}),
        counterparty: entry.counterparty ?? null,
        description: typeof entry.description === "string" ? entry.description.slice(0, 140) : null,
        status: entryStatus,
        matchedTo: entry.matchedLabel ?? null,
      });
    }
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const sumRon = (dir: string) => round2(rows.filter((row) => row.direction === dir).reduce((sum, row) => sum + Number(row.amountRon ?? 0), 0));
  return summarize(rows, "amount", {
    statements: snapshot.size,
    inRon: sumRon("in"),
    outRon: sumRon("out"),
    unmatchedCount: rows.filter((row) => row.status === "unmatched").length,
    reviewCount: rows.filter((row) => row.status === "review").length,
  });
}

async function listEvents(input: ToolInput) {
  const snapshot = await firestore().collection("adminEvents").orderBy("eventDate", "asc").get();
  const from = str(input.from);
  const to = str(input.to);
  const status = str(input.status);
  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const pricing = (data.pricing ?? {}) as Row;
      return {
        id: doc.id,
        date: toIso(data.eventDate)?.slice(0, 10) ?? null,
        type: data.type ?? null,
        client: (data.client as Row | undefined)?.fullName ?? null,
        status: data.status ?? null,
        totalEur: num(pricing.total) ?? null,
        remainingEur: num(pricing.remainingAmount) ?? null,
      } as Row;
    })
    .filter((row) => !from || (row.date != null && String(row.date) >= from))
    .filter((row) => !to || (row.date != null && String(row.date) <= to))
    .filter((row) => !status || row.status === status);
  const totalEur = round2(rows.reduce((sum, row) => sum + Number(row.totalEur ?? 0), 0));
  const remainingEur = round2(rows.reduce((sum, row) => sum + Number(row.remainingEur ?? 0), 0));
  return { count: rows.length, totalEur, remainingEur, truncated: rows.length > MAX_ROWS, rows: rows.slice(0, MAX_ROWS) };
}

const TOOL_HANDLERS: Record<string, (input: ToolInput) => Promise<unknown>> = {
  list_invoices: listInvoices,
  list_expenses: listExpenses,
  list_bank_transactions: listBankTransactions,
  list_events: listEvents,
};

const TOOL_LABELS: Record<string, string> = {
  list_invoices: "facturi",
  list_expenses: "cheltuieli",
  list_bank_transactions: "extrase bancare",
  list_events: "evenimente",
};

export const FINANCE_SYSTEM_PROMPT = `Ești asistentul financiar intern al lui AncaVisuals — PFA în sistem real, fotograf/videograf de nuntă din România — integrat în pagina "Financiar" din panoul de admin. Vorbești în română, concis și direct.

Date:
- Ai unelte read-only pentru facturi emise, cheltuieli, tranzacții din extrasele bancare și evenimente. Folosește-le ori de câte ori întrebarea are nevoie de cifre; nu ghici și nu inventa date. Poți apela mai multe unelte (și pe ani diferiți) înainte să răspunzi.
- Folosește totalurile întoarse de unelte (totalRon, deductibleRon, inRon, outRon etc.) în loc să aduni manual multe rânduri. Când un rezultat are truncated: true, spune că lista e parțială sau filtrează mai precis.
- "Context pagină" de mai jos conține cifrele calculate pe ecran (taxe, proiecție la 31 dec, cotă de pus deoparte). Când discuți taxe, pornește de la ele ca să fie consecvente cu ce vede utilizatorul.
- Sumele în EUR sunt convertite la cursul BNR din ziua documentului. Evenimentele au prețul în EUR.

Reguli PFA sistem real (venituri 2026; salariul minim pentru contribuții = cel de la 1 ianuarie 2026, 4.050 RON — creșterea la 4.325 RON din iulie nu contează pentru PFA):
- Venit net = încasări − cheltuieli deductibile. Cheltuiala e deductibilă doar dacă e făcută în interesul activității, cu document justificativ pe CIF-ul PFA și plătită.
- CASS 10% din venitul net real, bază minimă 6 salarii minime (24.300 RON) și maximă 72. Sub 6 salarii minime se plătește totuși pe 6, cu excepția cazului în care persoana e asigurată din altă sursă (salariu, pensie). Deci nu poți scăpa de CASS făcând cheltuieli.
- CAS (pensie) 25%: obligatoriu doar dacă venitul net ≥ 12 salarii minime (48.600 RON); baza e 12 salarii minime (între 12 și 24) sau 24 (≥ 97.200 RON). E un SALT: primul leu peste prag aduce 25% × 12 salarii minime = 12.150 RON. Banii de CAS contează la pensie, nu sunt pierduți integral.
- Impozit 10% din (venit net − CAS − CASS).
- Efect marginal între praguri: 1.000 RON cheltuială deductibilă reduc taxele cu ~190 RON, deci cheltuiala te costă tot ~810 RON. Nu "câștigi" cheltuind.
- Limitări: auto folosit și personal → 50% deductibil; protocol max 2% din (venit brut − cheltuieli fără protocol); masa proprie nedeductibilă; abonament medical/sport, asigurare de sănătate voluntară, pensie facultativă Pilon III → max 400 EUR/an fiecare; mijloace fixe peste 2.500 RON se amortizează, nu se deduc integral în anul cumpărării; cursurile legate de activitate sunt deductibile.
- Furnizorii din străinătate (Google Ads, Meta, Adobe, SaaS) sunt deductibili, dar pot declanșa taxare inversă TVA (D301) dacă PFA are cod de TVA art. 316/317.
- Declarația unică D212 și plata pentru veniturile din 2026: până la 25 mai 2027.

Cum răspunzi:
- La "merită să cumpăr / să plătesc X?": calculează cât scad taxele, cât costă net și dacă te ține sub/peste pragul CAS în proiecția de final de an.
- Sugerează cheltuieli doar dacă sunt utile real activității (echipament, software, cursuri, marketing, transport la evenimente). Descurajează cheltuielile făcute doar pentru taxe și cheltuielile personale trecute pe PFA.
- La extrase: semnalează plățile "unmatched" (fără document) — sunt cheltuieli posibil deductibile pierdute sau trebuie justificate.
- Nu ești consultant fiscal certificat: pentru sume finale de declarat, recomandă confirmarea cu un contabil, dar fără să repeți asta la fiecare mesaj.`;

router.post("/chat", async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
    return;
  }
  const context = typeof req.body?.context === "string" ? req.body.context.slice(0, 12000) : "";
  const history = sanitizeMessages(req.body?.messages);
  if (history.length === 0) {
    res.status(400).json({ error: "Niciun mesaj de trimis." });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `${FINANCE_SYSTEM_PROMPT}\n\nData de azi: ${today}.\n\n--- Context pagină ---\n${context || "(niciun context furnizat de pagină)"}`;
  const messages: Anthropic.MessageParam[] = history.map((message) => ({ role: message.role, content: message.content }));
  const sources = new Set<string>();

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: TOOLS,
        // Ultima rundă: fără unelte, ca să forțăm un răspuns cu ce s-a adunat până acum.
        ...(round === MAX_TOOL_ROUNDS ? { tool_choice: { type: "none" as const } } : {}),
        messages,
      });

      const toolUses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        res.json({ reply: text || "Nu am reușit să formulez un răspuns.", sources: [...sources] });
        return;
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(toolUses.map(async (use) => {
        const handler = TOOL_HANDLERS[use.name];
        if (!handler) return { type: "tool_result" as const, tool_use_id: use.id, content: `Unealtă necunoscută: ${use.name}`, is_error: true };
        try {
          const input = (use.input ?? {}) as ToolInput;
          const result = await handler(input);
          sources.add(`${TOOL_LABELS[use.name]}${typeof input.year === "number" ? ` ${input.year}` : ""}`);
          return { type: "tool_result" as const, tool_use_id: use.id, content: JSON.stringify(result) };
        } catch (error) {
          console.error(`[finance-assistant] tool ${use.name} failed:`, error);
          return { type: "tool_result" as const, tool_use_id: use.id, content: "Nu am putut citi datele.", is_error: true };
        }
      }));
      messages.push({ role: "user", content: results });
    }
  } catch (error) {
    console.error("[finance-assistant] chat failed:", error);
    res.status(500).json({ error: "Asistentul nu a putut răspunde." });
  }
});

export default router;
