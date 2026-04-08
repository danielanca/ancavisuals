import pricesData from "../../data/prices.json" with { type: "json" };

const p = (id: string) => pricesData.packages.find(pkg => pkg.id === id)?.price ?? 0;

const photoboothBase = p("photobooth");
const photoboothTiers = (pricesData.packages.find(pkg => pkg.id === "photobooth") as any)?.participantTiers ?? [];

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
      { label: "Prețuri și pachete", intentId: "pret" },
      { label: "Tipuri de evenimente", intentId: "servicii" },
      { label: "Zona de acoperire", intentId: "zona" },
      { label: "Verifică disponibilitate dată", intentId: "verificare_data" },
    ],
  },
  {
    id: "pret",
    botMessage:
      `Pachetele noastre:\n\n📷 Fotografie: ${p("photo").toLocaleString("ro-RO")} EUR\n🎥 Videografie: ${p("video").toLocaleString("ro-RO")} EUR\n🖼️ Album foto: ${p("album").toLocaleString("ro-RO")} EUR\n📸 Fotocabina: de la ${p("photobooth").toLocaleString("ro-RO")} EUR*\n🎡 Video Cabina 360: ${p("videobooth").toLocaleString("ro-RO")} EUR\n\nPrețul exact depinde de tipul evenimentului și durata acestuia.`,
    suggestions: [
      { label: "Preț fotocabina după participanți", intentId: "pret_fotocabina" },
      { label: "Vreau să rezerv o dată", intentId: "rezervare" },
      { label: "Cum funcționează procesul?", intentId: "proces" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "pret_fotocabina",
    botMessage: "Câți participanți estimați la eveniment?",
    suggestions: photoboothTiers.map((tier: any) => ({
      label: tier.label,
      intentId: `fotocabina_tier_${tier.label.replace(/\s+/g, "_")}`,
    })),
  },
  ...photoboothTiers.map((tier: any) => ({
    id: `fotocabina_tier_${tier.label.replace(/\s+/g, "_")}`,
    botMessage: tier.extra === 0
      ? `📸 Fotocabina pentru ${tier.label.toLowerCase()}: ${photoboothBase.toLocaleString("ro-RO")} EUR\n\n💡 ${tier.extraNote}`
      : `📸 Fotocabina pentru ${tier.label.toLowerCase()}: ${(photoboothBase + tier.extra).toLocaleString("ro-RO")} EUR\n\n${photoboothBase.toLocaleString("ro-RO")} EUR bază + ${tier.extra.toLocaleString("ro-RO")} EUR supliment\n\n💡 ${tier.extraNote}`,
    suggestions: [
      { label: "Vreau să rezerv", intentId: "rezervare" },
      { label: "Înapoi la prețuri", intentId: "pret" },
      { label: "Alte întrebări", intentId: "welcome" },
    ],
  })),
  {
    id: "servicii",
    botMessage:
      "Fotografiem și filmăm:\n\n💍 Nunți\n👶 Botezuri\n💑 Logodne & Cununie civilă\n🎉 Petreceri private\n🏢 Evenimente corporate\n\nFiecare eveniment primește aceeași atenție și pasiune.",
    suggestions: [
      { label: "Prețuri", intentId: "pret" },
      { label: "Vreau să rezerv", intentId: "rezervare" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "proces",
    botMessage:
      "Procesul este simplu:\n\n1️⃣ Completezi formularul de disponibilitate\n2️⃣ Te contactăm în 24h pentru confirmare\n3️⃣ Semnăm contractul, plătești avansul\n4️⃣ Ne ocupăm noi de tot în ziua evenimentului\n5️⃣ Primești galeria foto/video în termenul agreat",
    suggestions: [
      { label: "Cât durează livrarea?", intentId: "livrare" },
      { label: "Vreau să rezerv", intentId: "rezervare" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "livrare",
    botMessage:
      "Termenul de livrare:\n\n📷 Galeria foto: 4–6 săptămâni\n🎥 Filmul video: 6–10 săptămâni\n\nPentru nunți livrăm și un preview în primele 1–2 săptămâni.",
    suggestions: [
      { label: "Vreau să rezerv", intentId: "rezervare" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "zona",
    botMessage:
      "Suntem bazați în Turda și acoperim:\n\n📍 Turda – fără taxă de deplasare\n🚗 Județele Cluj, Alba, Sibiu, Arad, Bistrița și București – cu taxă de deplasare (se decontează strict motorina)\n✈️ Internațional – la cerere\n\nNu refuzăm nicio destinație frumoasă 😊",
    suggestions: [
      { label: "Prețuri", intentId: "pret" },
      { label: "Vreau să rezerv", intentId: "rezervare" },
      { label: "Înapoi", intentId: "welcome" },
    ],
  },
  {
    id: "rezervare",
    botMessage:
      "Super! Poți verifica disponibilitatea și configura pachetul direct din formularul nostru.\n\nDupă trimitere, te contactăm în mai puțin de 24h.",
    suggestions: [
      { label: "Verifică o dată", intentId: "verificare_data" },
      { label: "Deschide formularul →", intentId: "link_contact" },
      { label: "Alte întrebări", intentId: "welcome" },
    ],
  },
  {
    id: "verificare_data",
    botMessage: "Introdu data evenimentului în formatul ZZ/LL/AAAA\nEx: 15/06/2026",
    suggestions: [],
  },
];

export const FALLBACK_NODE: ChatNode = {
  id: "fallback",
  botMessage:
    "Nu am înțeles întrebarea. Poți alege una din opțiunile de mai jos sau scrie mai detaliat 😊",
  suggestions: [
    { label: "Prețuri și pachete", intentId: "pret" },
    { label: "Tipuri de evenimente", intentId: "servicii" },
    { label: "Vreau să rezerv", intentId: "rezervare" },
  ],
};

export const CHAT_NODES = new Map<string, ChatNode>(nodes.map(n => [n.id, n]));
