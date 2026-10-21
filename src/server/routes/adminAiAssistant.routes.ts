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

export default router;
