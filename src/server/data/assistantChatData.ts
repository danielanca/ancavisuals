import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

type PricePackage = {
  id: string;
  price: number;
  participantTiers?: PhotoboothTier[];
};

type PricesData = {
  packages: PricePackage[];
};

type PhotoboothTier = {
  label: string;
  extra: number;
  extraNote: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const pricesData = JSON.parse(readFileSync(join(__dirname, "../../shared/pricing/prices.json"), "utf-8")) as PricesData;

const getPackagePrice = (packageId: string) => (
  pricesData.packages.find(pricePackage => pricePackage.id === packageId)?.price ?? 0
);

const photoboothBasePrice = getPackagePrice("photobooth");
const photoboothParticipantTiers: PhotoboothTier[] = (
  pricesData.packages.find(pricePackage => pricePackage.id === "photobooth")?.participantTiers ?? []
);

export interface ChatSuggestion {
  label: string;
  intentId: string;
}

export interface ChatNode {
  id: string;
  botMessage: string;
  suggestions: ChatSuggestion[];
}

const nodes: ChatNode[] = [
  {
    id: "welcome",
    botMessage: "Bună! Sunt asistentul Anca Visuals 👋\nCu ce te pot ajuta?",
    suggestions: [
      { label: "Prețuri și pachete", intentId: "pricing" },
      { label: "Tipuri de evenimente", intentId: "services" },
      { label: "QR Moments (gratuit)", intentId: "qr_moments" },
      { label: "Zona de acoperire", intentId: "coverage" },
      { label: "Verifică disponibilitate dată", intentId: "check_date" },
    ],
  },
  {
    id: "pricing",
    botMessage:
      `Pachetele noastre:\n\n📷 Fotografie: ${getPackagePrice("photo").toLocaleString("ro-RO")} EUR\n🎥 Videografie: ${getPackagePrice("video").toLocaleString("ro-RO")} EUR\n🖼️ Album foto: ${getPackagePrice("album").toLocaleString("ro-RO")} EUR\n📸 Fotocabina: de la ${getPackagePrice("photobooth").toLocaleString("ro-RO")} EUR*\n🎡 Video Cabina 360: ${getPackagePrice("videobooth").toLocaleString("ro-RO")} EUR\n\nPrețul exact depinde de tipul evenimentului și durata acestuia.`,
    suggestions: [
      { label: "Preț fotocabina după participanți", intentId: "photobooth_pricing" },
      { label: "Vreau să rezerv o dată", intentId: "booking" },
      { label: "Cum funcționează procesul?", intentId: "process" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "photobooth_pricing",
    botMessage: "Câți participanți estimați la eveniment?",
    suggestions: photoboothParticipantTiers.map((participantTier: PhotoboothTier) => ({
      label: participantTier.label,
      intentId: `photobooth_tier_${participantTier.label.replace(/\s+/g, "_")}`,
    })),
  },
  ...photoboothParticipantTiers.map((participantTier: PhotoboothTier) => ({
    id: `photobooth_tier_${participantTier.label.replace(/\s+/g, "_")}`,
    botMessage: participantTier.extra === 0
      ? `📸 Fotocabina pentru ${participantTier.label.toLowerCase()}: ${photoboothBasePrice.toLocaleString("ro-RO")} EUR\n\n💡 ${participantTier.extraNote}`
      : `📸 Fotocabina pentru ${participantTier.label.toLowerCase()}: ${(photoboothBasePrice + participantTier.extra).toLocaleString("ro-RO")} EUR\n\n${photoboothBasePrice.toLocaleString("ro-RO")} EUR bază + ${participantTier.extra.toLocaleString("ro-RO")} EUR supliment\n\n💡 ${participantTier.extraNote}`,
    suggestions: [
      { label: "Vreau să rezerv", intentId: "booking" },
      { label: "Înapoi la prețuri", intentId: "pricing" },
      { label: "Alte întrebări", intentId: "welcome" },
    ],
  })),
  {
    id: "services",
    botMessage:
      "Fotografiem și filmăm:\n\n💍 Nunți\n👶 Botezuri\n💑 Logodne & Cununie civilă\n🎉 Petreceri private\n🏢 Evenimente corporate\n\n📱 QR Moments – complet GRATUIT!\nInvitații tăi scanează un cod QR și încarcă poze și videoclipuri direct de pe telefon, în timp real.\n\nFiecare eveniment primește aceeași atenție și pasiune.",
    suggestions: [
      { label: "Ce este QR Moments?", intentId: "qr_moments" },
      { label: "Prețuri", intentId: "pricing" },
      { label: "Vreau să rezerv", intentId: "booking" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "qr_moments",
    botMessage:
      "📱 QR Moments — 100% Gratuit!\n\nO funcție unică pe care o oferim la orice eveniment fotografiat sau filmat de noi.\n\nCum funcționează:\n1️⃣ Plasezi un cod QR la eveniment (pe masă, invitații, ecran)\n2️⃣ Invitații scanează și încarcă poze & video direct de pe telefon\n3️⃣ Tu primești toate amintirile adunate într-un singur loc\n\nNu necesită aplicație. Funcționează instant. Este gratuit.",
    suggestions: [
      { label: "Vreau QR Moments la evenimentul meu", intentId: "booking" },
      { label: "Înapoi la servicii", intentId: "services" },
      { label: "Prețuri pachete", intentId: "pricing" },
    ],
  },
  {
    id: "process",
    botMessage:
      "Procesul este simplu:\n\n1️⃣ Completezi formularul de disponibilitate\n2️⃣ Te contactăm în 24h pentru confirmare\n3️⃣ Semnăm contractul, plătești avansul\n4️⃣ Ne ocupăm noi de tot în ziua evenimentului\n5️⃣ Primești galeria foto/video în termenul agreat",
    suggestions: [
      { label: "Cât durează livrarea?", intentId: "delivery" },
      { label: "Vreau să rezerv", intentId: "booking" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "delivery",
    botMessage:
      "Termenul de livrare:\n\n📷 Galeria foto: 4–6 săptămâni\n🎥 Filmul video: 6–10 săptămâni\n\nPentru nunți livrăm și un preview în primele 1–2 săptămâni.",
    suggestions: [
      { label: "Vreau să rezerv", intentId: "booking" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "coverage",
    botMessage:
      "Suntem bazați în Turda și acoperim:\n\n📍 Turda – fără taxă de deplasare\n🚗 Județele Cluj, Alba, Sibiu, Arad, Bistrița și București – cu taxă de deplasare (se decontează strict motorina)\n✈️ Internațional – la cerere\n\nNu refuzăm nicio destinație frumoasă 😊\n\nDacă dorești să vorbești direct cu noi, personal, apasă butonul de WhatsApp și te redirecționăm către noi.",
    suggestions: [
      { label: "Prețuri", intentId: "pricing" },
      { label: "Vreau să rezerv", intentId: "booking" },
      { label: "Vorbește direct cu noi pe WhatsApp", intentId: "whatsapp" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "booking",
    botMessage:
      "Super! Poți verifica disponibilitatea și configura pachetul direct din formularul nostru.\n\nDupă trimitere, te contactăm în mai puțin de 24h.",
    suggestions: [
      { label: "Verifică o dată", intentId: "check_date" },
      { label: "Deschide formularul →", intentId: "link_contact" },
      { label: "Alte întrebări", intentId: "welcome" },
    ],
  },
  {
    id: "check_date",
    botMessage: "Introdu data evenimentului în formatul ZZ/LL/AAAA\nEx: 15/06/2026",
    suggestions: [],
  },
  {
    id: "leave_phone",
    botMessage: "Super! Introdu numărul tău de telefon și te contactăm noi cât mai curând 📞",
    suggestions: [],
  },
  {
    id: "phone_confirmed",
    botMessage: "✅ Mulțumim! Am notat numărul tău și te contactăm în cel mai scurt timp pentru a discuta detaliile.",
    suggestions: [
      { label: "Alte întrebări", intentId: "welcome" },
    ],
  },
];

export const FALLBACK_NODE: ChatNode = {
  id: "fallback",
  botMessage:
    "Nu am înțeles întrebarea. Poți alege una din opțiunile de mai jos sau scrie mai detaliat 😊",
  suggestions: [
    { label: "Prețuri și pachete", intentId: "pricing" },
    { label: "Tipuri de evenimente", intentId: "services" },
    { label: "Vreau să rezerv", intentId: "booking" },
  ],
};

export const CHAT_NODES = new Map<string, ChatNode>(
  nodes.map(chatNode => [chatNode.id, chatNode]),
);
