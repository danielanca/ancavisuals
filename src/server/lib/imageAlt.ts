import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const SYSTEM_PROMPT = `Ești editor accesibilitate pentru un studio foto-video din România. Scrii texte alt în limba română pentru imagini publice de pe site. Descrie strict ce este vizibil. Dacă în imagine se vede clar un cuplu de nuntă — de exemplu un bărbat în costum formal și o femeie în rochie albă de mireasă, în context ceremonial sau romantic — numește-i „mire și mireasă", nu doar „bărbat și femeie". Nu folosi „mireasă" doar pentru că o femeie poartă alb și nu folosi „mire" doar pentru că un bărbat poartă costum; dacă contextul de nuntă nu este suficient de clar, rămâi neutru. Nu inventa nume, locații, orașe, evenimente sau relații între persoane. Nu îndesa cuvinte-cheie SEO. Un alt text trebuie să fie natural, concret și de maximum 125 de caractere. Pentru logo-uri, iconuri sau imagini pur decorative returnează skip=true și alt gol.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Lipsește ANTHROPIC_API_KEY din .env.");
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function parseClaudeJson(text: string): { alt: string; skip: boolean } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude nu a returnat JSON valid");
  const parsed = JSON.parse(match[0]) as { alt?: unknown; skip?: unknown };
  return {
    alt: typeof parsed.alt === "string" ? parsed.alt.trim() : "",
    skip: parsed.skip === true,
  };
}

export type ImageAltResult = { alt: string; skip: boolean };

// Fetches the image and asks Claude Vision for a Romanian alt text. Shared by the Media
// Assets and Instagram proposals admin generators, and by scripts/generateImageAlts.ts.
export async function generateRomanianAlt(imageUrl: string, hint = ""): Promise<ImageAltResult> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Imagine HTTP ${response.status}`);
  const mediaType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType as SupportedMediaType)) {
    throw new Error(`Format nesuportat: ${mediaType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error(`Imagine prea mare: ${buffer.byteLength} bytes`);

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 180,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType as SupportedMediaType, data: buffer.toString("base64") },
        },
        {
          type: "text",
          text: `${hint ? `Context: ${hint}\n` : ""}Returnează DOAR JSON: {"alt":"...","skip":false}`,
        },
      ],
    }],
  });

  const text = message.content.find(block => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Răspuns Claude fără text");
  return parseClaudeJson(text.text);
}
