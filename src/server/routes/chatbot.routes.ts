import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import pricesData from "../../client/data/prices.json";

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const photoPrice = pricesData.services.find(s => s.id === "photo")!.price;
const videoPrice = pricesData.services.find(s => s.id === "video")!.price;

const servicesText = pricesData.services
  .map(s => `- ${s.title}: ${s.price} RON — ${s.note}`)
  .join("\n");

const SYSTEM_PROMPT = `Ești asistentul virtual al Anca Visuals, un studio profesionist de fotografie și videografie din România.

Răspunzi DOAR în română. Ești prietenos, concis și util.

SERVICII ȘI PREȚURI:
${servicesText}

PACHETE COMBINATE (orientativ):
- Doar fotografie: de la ${photoPrice} RON
- Foto + video: de la ${photoPrice + videoPrice} RON
- Foto + video + extras (album, booth etc.): prețul variază în funcție de opțiuni

TIPURI DE EVENIMENTE ACOPERITE:
- Nunți
- Botezuri
- Petreceri și aniversări
- Ședințe foto portret
- Evenimente corporate

DISPONIBILITATE:
- Pentru a verifica disponibilitatea pentru o anumită dată, direcționează clientul să completeze formularul de contact sau să facă o rezervare la secțiunea /contact a site-ului.

LIVRARE:
- Fotografiile și videoclipurile sunt livrate online printr-un link personalizat de descărcare.

CONTACT ȘI REZERVARE:
- Clienții pot face o rezervare sau trimite un mesaj accesând pagina /contact de pe site.

Dacă nu știi răspunsul la o întrebare specifică, îndrumă clientul să contacteze direct echipa prin pagina de contact.
Nu inventa prețuri sau servicii care nu sunt menționate mai sus.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Mesajele lipsesc." });
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return res.json({ reply: text });
  } catch (error) {
    console.error("Chatbot error:", error);
    return res.status(500).json({ error: "Eroare la procesarea mesajului." });
  }
});

export default router;
