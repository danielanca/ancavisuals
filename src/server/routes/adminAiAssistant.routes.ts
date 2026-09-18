import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

// Asistent AI generic pentru admin — orice pagină îi poate trimite un rezumat text al
// datelor curent afișate ("context") și o listă de mesaje; el răspunde folosind DOAR acel
// context, nu date inventate. Gândit ca să fie reutilizat pe mai multe pagini, nu doar una.
const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export default router;
