import { createAnthropicClient } from "../lib/anthropicClient";
import { Router } from "express";
import type { Request, Response } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

// Asistent AI generic pentru admin — orice pagină îi poate trimite un rezumat text al
// datelor curent afișate ("context") și o listă de mesaje; el răspunde folosind DOAR acel
// context, nu date inventate. Gândit ca să fie reutilizat pe mai multe pagini, nu doar una.
const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);
const anthropic = createAnthropicClient("Asistent admin", { apiKey: process.env.ANTHROPIC_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { role: unknown; content: unknown } => item !== null && typeof item === "object")
    .map((item) => ({
      role: (item as { role: unknown }).role === "assistant" ? "assistant" as const : "user" as const,
      content: typeof (item as { content: unknown }).content === "string" ? (item as { content: string }).content.slice(0, 4000) : "",
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-20);
}

router.post("/chat", async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
    return;
  }
  const context = typeof req.body?.context === "string" ? req.body.context.slice(0, 8000) : "";
  const messages = sanitizeMessages(req.body?.messages);
  if (messages.length === 0) {
    res.status(400).json({ error: "Niciun mesaj de trimis." });
    return;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Ești un asistent intern pentru administratorul AncaVisuals (fotograf/videograf de nuntă din România), integrat direct în panoul de admin. Utilizatorul îți vede exact aceleași date pe ecran — mai jos ai un rezumat text al lor ("context pagină"). Folosește STRICT acel context pentru orice cifră sau calcul; dacă informația nu apare acolo, spune clar că nu ai acea informație, nu o inventa. Răspunde concis, în română, direct la subiect. Nu ești consultant fiscal certificat — dacă discuția atinge o obligație legală/fiscală, poți explica ce arată datele, dar menționează că sumele finale trebuie confirmate cu un contabil.\n\n--- Context pagină curentă ---\n${context || "(niciun context furnizat de pagină)"}`,
      messages,
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    res.json({ reply: text || "Nu am reușit să formulez un răspuns." });
  } catch (error) {
    console.error("[admin-ai-assistant] chat failed:", error);
    res.status(500).json({ error: "Asistentul nu a putut răspunde." });
  }
});

// Ghidul de pe Dashboard: adminul întreabă „unde găsesc X / cum fac Y”, asistentul răspunde
// cu locul din meniu și un link. Lista paginilor vine din client (aceeași ca la căutarea
// din dashboard, `ADMIN_PAGES`), ca să rămână mereu sincronizată cu meniul.
type GuidePage = { label: string; path: string; category: string; keywords: string };

function sanitizePages(raw: unknown): GuidePage[] {
  if (!Array.isArray(raw)) return [];
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      label: text(item.label, 80),
      path: text(item.path, 120),
      category: text(item.category, 60),
      keywords: text(item.keywords, 300),
    }))
    .filter((page) => page.label && page.path.startsWith("/"))
    .slice(0, 200);
}

const GUIDE_INSTRUCTIONS = `Ești ghidul panoului de admin AncaVisuals (fotograf/videograf de nuntă din România). Adminul te întreabă unde găsește ceva sau cum face ceva în admin. Răspunde în română, scurt (2–4 propoziții), cu locul exact:
- numele paginii și categoria din meniul din stânga în care se află (ex. „în meniu, la Oferte → Prețuri de pornire”);
- un link Markdown către pagină, exact în forma [Numele paginii](/cale), folosind DOAR căile din lista de mai jos — nu inventa căi;
- dacă e util, ce să caute sau să apese pe acea pagină, doar dacă reiese din cuvintele-cheie ale paginii.
Fără alte formatări Markdown (fără ** sau titluri) — doar text simplu și linkurile. Dacă mai multe pagini se potrivesc, dă cel mult trei, cea mai probabilă prima. Dacă nimic din listă nu se potrivește, spune sincer că nu găsești pagina și sugerează căutarea din Dashboard (⌘K). Nu răspunde la întrebări fără legătură cu adminul.`;

router.post("/guide", async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
    return;
  }
  const pages = sanitizePages(req.body?.pages);
  const messages = sanitizeMessages(req.body?.messages);
  if (messages.length === 0 || messages[0].role !== "user") {
    res.status(400).json({ error: "Niciun mesaj de trimis." });
    return;
  }
  const pageList = pages.map((page) => `- ${page.category} → ${page.label}: ${page.path}${page.keywords ? ` (cuvinte-cheie: ${page.keywords})` : ""}`).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2048,
      // A short navigation answer: little reasoning needed.
      output_config: { effort: "low" },
      // The instructions + page list are the same on every question: cached.
      system: [{ type: "text", text: `${GUIDE_INSTRUCTIONS}\n\n--- Paginile din admin ---\n${pageList || "(lista de pagini lipsește)"}`, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") {
      res.json({ reply: "Nu pot răspunde la asta. Încearcă să întrebi altfel, de exemplu „unde schimb prețurile?”." });
      return;
    }
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    res.json({ reply: text || "Nu am reușit să formulez un răspuns." });
  } catch (error) {
    console.error("[admin-ai-assistant] guide failed:", error);
    res.status(500).json({ error: "Ghidul nu a putut răspunde." });
  }
});

// „✨ Înfrumusețează” din bara de text a adminului (AdminTextAssist): textul dictat sau scris în
// grabă devine text curat, natural, în română — fără să schimbe ce spune. `format: "html"` =
// editorul de clauze (HTML simplu cu placeholdere {{...}}).
export const POLISH_TEXT_MAX = 12_000;

export const POLISH_INSTRUCTIONS = `Primești un text scris sau dictat (speech-to-text) de administratorul AncaVisuals (fotograf/videograf de nuntă din România). Rescrie-l curat, ca și cum l-ar fi scris un om atent, în română:
- corectează greșelile de dictare (cuvinte auzite greșit, repetiții, „ăă”), gramatica, punctuația și diacriticele;
- împarte în propoziții și paragrafe firești; păstrează tonul autorului (cald cu clienții, precis în contracte);
- păstrează EXACT sensul, faptele, numele, datele, sumele, numerele de telefon, linkurile și orice placeholder de forma {{nume}} sau [ceva]; nu adăuga informații, promisiuni, saluturi sau semnături care nu există;
- scrie natural, nu ca un AI: fără clișee („Sperăm că acest mesaj vă găsește bine”), fără exagerări, fără liniuțe lungi (—), fără liste sau titluri dacă originalul nu le are;
- dacă e o clauză de contract: formulare juridică clară și precisă, în persoana a treia („Prestatorul”, „Beneficiarul”), fără ambiguități;
- dacă textul e deja bun, schimbă cât mai puțin.
Răspunde DOAR cu textul final, fără explicații, ghilimele sau comentarii.`;

const POLISH_HTML_RULE = `Textul este HTML dintr-un editor (paragrafe <p>, <strong>, liste <ul><li>, <br>, eventual elemente cu atribute style). Păstrează structura și toate etichetele/atributele; modifică doar textul dintre ele. Răspunde cu HTML-ul final, fără blocuri de cod.`;

router.post("/polish", async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Lipsește ANTHROPIC_API_KEY din .env." });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) {
    res.status(400).json({ error: "Nu există text de înfrumusețat." });
    return;
  }
  if (text.length > POLISH_TEXT_MAX) {
    res.status(400).json({ error: "Textul e prea lung pentru înfrumusețare." });
    return;
  }
  const html = req.body?.format === "html";
  const field = typeof req.body?.field === "string" ? req.body.field.slice(0, 120).trim() : "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8192,
      output_config: { effort: "low" },
      system: [{ type: "text", text: html ? `${POLISH_INSTRUCTIONS}\n\n${POLISH_HTML_RULE}` : POLISH_INSTRUCTIONS, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `${field ? `Câmpul: ${field}\n\n` : ""}<text>\n${text}\n</text>` }],
    });
    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "AI-ul nu a putut prelucra acest text." });
      return;
    }
    const polished = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .replace(/^```(?:html)?\s*|\s*```$/g, "")
      .replace(/^<text>\s*|\s*<\/text>$/g, "")
      .trim();
    if (!polished) {
      res.status(502).json({ error: "AI-ul nu a întors niciun text." });
      return;
    }
    res.json({ text: polished });
  } catch (error) {
    console.error("[admin-ai-assistant] polish failed:", error);
    res.status(500).json({ error: "Textul nu a putut fi înfrumusețat." });
  }
});

export default router;
