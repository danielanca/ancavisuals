/*
 * Purpose: the "Update-uri" changelog shown at /admin/updates — what was added or changed on the
 * site, in plain words for the owner, newest first. RULE (AI_MEMORY.md): every change that ships
 * gets an entry here, at the top, with the time it was made and links to the pages it touched.
 */

export type ChangelogLink = { label: string; path: string };

export type ChangelogEntry = {
  /** Unique, never reused: the page colours and keys entries by it. */
  id: string;
  /** "YYYY-MM-DDTHH:mm" (Romania time); "YYYY-MM-DD" when the hour isn't known. */
  at: string;
  emoji: string;
  title: string;
  summary: string;
  details?: string[];
  links?: ChangelogLink[];
};

export const ADMIN_CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-27-guide-offer-preview",
    at: "2026-10-27T18:45",
    emoji: "💍",
    title: "Oferta, jos pe pagina Ghidului Mirilor",
    summary: "Sub butonul de descărcare a ghidului apar acum hero-ul, portofoliul și configuratorul de pe /oferta/olx, fără alte secțiuni. Se încarcă doar când vizitatorul ajunge jos.",
    links: [{ label: "Ghidul Mirilor PDF", path: "/ghidul-mirilor-pdf" }, { label: "Oferta", path: "/oferta/olx" }],
  },
  {
    id: "2026-10-27-iab-error-filter",
    at: "2026-10-27T17:40",
    emoji: "🧹",
    title: "Fără alerte false din browserul Facebook/Instagram",
    summary: "Eroarea „Java object is gone” nu mai apare la Erori și nu mai trimite notificări: vine din scripturile aplicației Facebook/Instagram pe Android, nu din site.",
    links: [{ label: "Erori", path: "/admin/errors" }],
  },
  {
    id: "2026-10-27-offer-title",
    at: "2026-10-27T17:20",
    emoji: "✏️",
    title: "Titlu mai simplu pe oferta OLX",
    summary: "Titlul mare de sus de pe ofertă e acum doar „Fotografii și film de nuntă.” — fără „fără rigiditate și fără surprize la preț”.",
  },
  {
    id: "2026-10-27-portfolio-music",
    at: "2026-10-27T17:11",
    emoji: "🎵",
    title: "Muzică de fundal la portofoliu",
    summary: "Sub titlul „Portofoliu” e acum un banner care îi invită pe clienți să pornească melodia „Ordinary” cât se uită prin poze.",
    details: [
      "Apare pe oferta OLX (și celelalte oferte), pe pagina Portofoliu și pe Contact — oriunde e galeria de portofoliu.",
      "Melodia pornește doar la apăsare, intră lin (fade in) și se oprește lin (fade out). Când clientul ajunge la configuratorul de preț, se aude mult mai încet.",
      "Bannerul e lat pe desktop: buton play pătrat care „respiră”, numele piesei (Ordinary · Alex Warren), bară de progres pe care se poate da click și timpul scurs / durata (3:07).",
      "Volum mai încet din start și un buton de volum lângă bara de progres; fiecare vizitator își păstrează volumul ales.",
      "Dacă clientul pornește un video cu sunet (sau filmul „Vedeți-ne la lucru”), melodia se oprește de tot. Clipurile fără sonor din partea de sus nu o opresc.",
      "După ce clientul a trecut de banner, apare jos în stânga un buton mic cu difuzor ca să oprească sau să repornească melodia.",
      "Dacă schimbă tabul sau blochează telefonul, muzica se oprește și revine când se întoarce. În panoul Live vezi „🎵 A pornit melodia de la portofoliu” (fără email).",
    ],
    links: [{ label: "Live", path: "/admin/live" }],
  },
  {
    id: "2026-10-27-changelog",
    at: "2026-10-27T16:55",
    emoji: "🗒️",
    title: "Pagina „Update-uri”",
    summary: "Un jurnal cu tot ce adăugăm pe site, fiecare schimbare în chenarul ei colorat, cu data, ora și linkuri spre paginile atinse.",
    details: ["Se găsește la finalul meniului din stânga, la „Update-uri”.", "De acum, fiecare schimbare nouă apare aici, sus."],
    links: [{ label: "Update-uri", path: "/admin/updates" }],
  },
  {
    id: "2026-10-27-text-assist",
    at: "2026-10-27T16:45",
    emoji: "✨",
    title: "Dictare și „Înfrumusețează” cu AI în toate câmpurile de text",
    summary: "Când dai click într-un câmp mare de text din admin, apare sus în dreapta o bară cu 🎙 Dictează și ✨ Înfrumusețează.",
    details: [
      "Dictează: vorbești în română, iar textul se scrie singur în câmp.",
      "Înfrumusețează: AI-ul corectează greșelile de dictare, gramatica și diacriticele și face textul natural, fără să-i schimbe sensul. „↩ Anulează” pune înapoi textul tău.",
      "Merge și la clauzele din contracte (editorul de clauze), păstrând formatarea și câmpurile de tip {{eventType}}.",
      "Funcționează în Chrome, Safari și Edge. În Firefox apare doar butonul AI.",
    ],
    links: [
      { label: "Biblioteca de clauze", path: "/admin/contracts/templates" },
      { label: "Taskuri", path: "/admin/taskuri" },
      { label: "Noutăți în masă", path: "/admin/album-updates" },
    ],
  },
  {
    id: "2026-10-27-bulk-composer",
    at: "2026-10-27T16:40",
    emoji: "📝",
    title: "Mesajul din „Noutăți în masă” nu se mai pierde",
    summary: "Ce scrii în mesaj rămâne salvat, chiar dacă schimbi data, alegi alt șablon sau reîncarci pagina.",
    details: [
      "Schimbarea datei sau a lui „Despre ce” nu-ți mai șterge textul. Dacă vrei textul șablonului cu noua dată, apeși „Pune textul șablonului cu data aleasă”.",
      "Dacă alegi alt șablon după ce ai scris ceva, te întreabă întâi, iar mesajul tău poate fi adus înapoi cu „↩ Recuperează mesajul meu”.",
      "Buton „Dictează” lângă mesaj.",
    ],
    links: [{ label: "Noutăți în masă", path: "/admin/album-updates" }],
  },
  {
    id: "2026-10-27-sms-log",
    at: "2026-10-27T16:30",
    emoji: "📤",
    title: "SMS-uri trimise",
    summary: "O pagină cu toate SMS-urile plecate de la site spre clienți: ora, numărul, evenimentul, de unde au plecat și textul exact.",
    details: [
      "Se văd și SMS-urile eșuate, cu motivul.",
      "Poți căuta după telefon (și cu 07…), nume, eveniment sau text.",
      "Apar doar SMS-urile trimise de acum înainte.",
    ],
    links: [
      { label: "SMS-uri trimise", path: "/admin/sms-log" },
      { label: "Noutăți în masă", path: "/admin/album-updates" },
    ],
  },
  {
    id: "2026-10-27-guide-mic",
    at: "2026-10-27T16:38",
    emoji: "🎙",
    title: "Microfon în Ghidul AI",
    summary: "Poți pune întrebarea vorbind. Butonul de microfon stă lângă „Trimite” în Ghidul AI de pe Dashboard și la asistentul financiar.",
    links: [{ label: "Dashboard", path: "/admin" }, { label: "Financiar", path: "/admin/financial" }],
  },
  {
    id: "2026-10-26-handover-sms",
    at: "2026-10-26",
    emoji: "💬",
    title: "Procesul verbal se trimite și prin SMS",
    summary: "Lângă WhatsApp, butonul „💬 SMS” trimite clientului linkul spre procesul verbal, cu un mesaj pe care îl poți modifica.",
    details: ["Când clientul deschide PV-ul din SMS, primești email și apare în Activitate."],
    links: [{ label: "Procese verbale", path: "/admin/handover" }],
  },
  {
    id: "2026-10-26-free-photobooth",
    at: "2026-10-26",
    emoji: "🎁",
    title: "Fotocabina gratuită: 10 locuri, la alegere cu videobooth-ul",
    summary: "Promoția de nuntă are acum 10 locuri (termenul rămâne 30 octombrie), iar cadoul poate fi fotocabina sau videobooth-ul.",
  },
  {
    id: "2026-10-26-offer-page",
    at: "2026-10-26",
    emoji: "💍",
    title: "Oferta de nuntă refăcută",
    summary: "Pagina /oferta/olx are o ordine nouă (portofoliul, apoi direct configuratorul), vorbește cu „voi”, are un singur bloc „Ce primiți” și se încarcă mult mai repede pe mobil.",
  },
  {
    id: "2026-10-26-wedding-guide-pdf",
    at: "2026-10-26",
    emoji: "📘",
    title: "Pagina ghidului mirilor (PDF)",
    summary: "Pagina /ghidul-mirilor-pdf prezintă ghidul nou de 30 de pagini, scris de Daniel și Estera.",
  },
  {
    id: "2026-10-26-legal-footer",
    at: "2026-10-26",
    emoji: "⚖️",
    title: "Datele firmei în subsolul site-ului",
    summary: "Denumirea, CUI-ul, adresa și linkurile ANPC apar acum în footer, așa cum cere legea.",
  },
  {
    id: "2026-10-25-media-zip",
    at: "2026-10-25",
    emoji: "🗂️",
    title: "Descărcare selectivă în Media Assets",
    summary: "Bifezi pozele dorite și le descarci originalele într-un ZIP.",
    links: [{ label: "Media Assets", path: "/admin/media-assets" }],
  },
  {
    id: "2026-10-25-contract-email",
    at: "2026-10-25",
    emoji: "✉️",
    title: "Email nou la contractul semnat",
    summary: "Clientul primește o scrisoare curată, alb-negru, cu detaliile evenimentului și butonul pentru PDF.",
  },
];
