import { Router } from "express";
import type { Request, Response } from "express";
import { firestore } from "../firestore";
import { Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const router = Router();

const COLLECTION = "inspirationPhotos";

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

router.post("/inspiration/suggest-tags", async (req: Request, res: Response) => {
  try {
    const { query, availableTags } = req.body as { query: string; availableTags: string[] };
    if (!query?.trim() || !Array.isArray(availableTags)) {
      return res.status(400).json({ tags: [] });
    }

    // Build a normalized→original map so Claude works without diacritics
    const normalizedToOriginal = new Map<string, string>();
    for (const tag of availableTags) {
      normalizedToOriginal.set(stripDiacritics(tag), tag);
    }
    const normalizedTags = Array.from(normalizedToOriginal.keys());
    const normalizedQuery = stripDiacritics(query);

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Ești un asistent pentru un fotograf. Lista completă de tag-uri disponibile este:
${normalizedTags.join(", ")}

Utilizatorul caută poze descriind: "${normalizedQuery}"

Reguli stricte:
1. Returnează DOAR tag-uri din lista de mai sus, exact cum sunt scrise.
2. Dacă un cuvânt din descriere apare exact sau aproape exact într-un tag din listă, include-l obligatoriu.
3. Include și tag-uri semantice relevante (ex: "mire+mireasa" dacă se menționează cuplu).
4. Nu adăuga niciun tag care nu există în lista de mai sus.
5. Răspunde DOAR cu un JSON array, fără text suplimentar.

Exemplu răspuns: ["mire", "mireasa", "biserica"]`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const match = raw.match(/\[.*\]/s);
    const returnedNormalized: string[] = match ? JSON.parse(match[0]) : [];

    // Map back to original tags with diacritics
    const validTags = returnedNormalized
      .map((tag) => normalizedToOriginal.get(stripDiacritics(tag)))
      .filter((tag): tag is string => tag !== undefined);

    res.json({ tags: validTags });
  } catch (error) {
    console.error("[inspiration] suggest-tags failed:", error);
    res.status(500).json({ tags: [] });
  }
});

router.post("/inspiration/suggest-tags-from-image", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, availableTags } = req.body as {
      imageBase64: string;
      mediaType: string;
      availableTags: string[];
    };
    if (!imageBase64 || !Array.isArray(availableTags)) {
      return res.status(400).json({ tags: [] });
    }

    const normalizedToOriginal = new Map<string, string>();
    for (const tag of availableTags) {
      normalizedToOriginal.set(stripDiacritics(tag), tag);
    }
    const normalizedTags = Array.from(normalizedToOriginal.keys());

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Ești un asistent pentru un fotograf de nuntă. Analizează această fotografie și generează tag-uri descriptive.

Tag-uri existente ca referință (poți folosi oricare din ele dacă sunt relevante): ${normalizedTags.join(", ")}

Instrucțiuni:
1. Generează tag-uri relevante pentru ce vezi în imagine — poți folosi tag-uri din lista de referință SAU poți crea tag-uri noi descriptive (ex: "golden-hour", "voal", "tort-nunta", "first-dance").
2. Tag-urile noi să fie scurte, lowercase, fără diacritice, cu cratimă în loc de spațiu.
3. Returnează 3-8 tag-uri cele mai relevante.
4. Răspunde DOAR cu un JSON array, fără text suplimentar.

Exemplu răspuns: ["mire", "mireasa", "biserica", "golden-hour", "voal"]`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const match = raw.match(/\[.*\]/s);
    const generatedTags: string[] = match ? JSON.parse(match[0]) : [];

    // Map back to original tags with diacritics where possible; keep new tags as-is
    const validTags = generatedTags.map((tag) => {
      const normalized = stripDiacritics(tag);
      return normalizedToOriginal.get(normalized) ?? tag;
    }).filter((tag) => typeof tag === "string" && tag.length > 0);

    res.json({ tags: validTags });
  } catch (error) {
    console.error("[inspiration] suggest-tags-from-image failed:", error);
    res.status(500).json({ tags: [] });
  }
});

router.get("/inspiration/photos", async (_req: Request, res: Response) => {
  try {
    const db = firestore();
    const snapshot = await db.collection(COLLECTION).orderBy("uploadedAt", "desc").get();
    const photos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt instanceof Timestamp
        ? doc.data().uploadedAt.toDate().toISOString()
        : doc.data().uploadedAt,
    }));
    res.json({ photos });
  } catch (error) {
    console.error("[inspiration] GET failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca pozele." });
  }
});

router.post("/inspiration/photos", async (req: Request, res: Response) => {
  try {
    const { url, tags, notes } = req.body;
    if (!url || !Array.isArray(tags)) {
      return res.status(400).json({ error: "url și tags sunt obligatorii." });
    }
    const db = firestore();
    const docRef = await db.collection(COLLECTION).add({
      url,
      tags,
      notes: notes ?? "",
      uploadedAt: Timestamp.now(),
    });
    res.status(201).json({ id: docRef.id });
  } catch (error) {
    console.error("[inspiration] POST failed:", error);
    res.status(500).json({ error: "Nu s-a putut salva poza." });
  }
});

router.patch("/inspiration/photos/:id", async (req: Request, res: Response) => {
  try {
    const { tags, notes } = req.body;
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).update({ tags, notes: notes ?? "" });
    res.json({ ok: true });
  } catch (error) {
    console.error("[inspiration] PATCH failed:", error);
    res.status(500).json({ error: "Nu s-au putut salva tag-urile." });
  }
});

router.delete("/inspiration/photos/:id", async (req: Request, res: Response) => {
  try {
    const db = firestore();
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error("[inspiration] DELETE failed:", error);
    res.status(500).json({ error: "Nu s-a putut șterge poza." });
  }
});

export default router;
