/*
 * Purpose: "pagini speciale" SEO — a landing page built with AI for a keyword where SEO Radar shows
 * we're absent ("—"), published at /servicii/<slug>, in the sitemap and linked to the keyword in
 * SEO Radar. Shared by the creator (/admin/seo-radar/pagina), the server and the public page.
 */

export const SEO_PAGE_BASE = "/servicii";
export const seoPagePath = (slug: string) => `${SEO_PAGE_BASE}/${slug}`;

export type SeoPageSection = { heading: string; html: string };
export type SeoPageFaq = { question: string; answer: string };

export type SeoLandingPage = {
  slug: string;
  keyword: string;
  city: string;
  status: "draft" | "published";
  /** <title>, max ~60 characters. */
  seoTitle: string;
  /** Meta description, max ~155 characters. */
  metaDescription: string;
  h1: string;
  subtitle: string;
  /** Opening paragraph(s), simple HTML. */
  intro: string;
  sections: SeoPageSection[];
  faq: SeoPageFaq[];
  updatedAt: string | null;
  publishedAt: string | null;
};

/** What the AI found about the keyword before writing (step 1 of the creator). */
export type SeoPagePlan = {
  intent: string;
  competitors: string;
  angle: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  outline: string[];
  secondaryKeywords: string[];
  questions: string[];
};

export const emptySeoPage = (keyword: string, city: string): SeoLandingPage => ({
  slug: "", keyword, city, status: "draft", seoTitle: "", metaDescription: "", h1: "", subtitle: "", intro: "",
  sections: [], faq: [], updatedAt: null, publishedAt: null,
});

export const slugifySeo = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");

const plain = (text: string) => text.replace(/<[^>]*>/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
const words = (text: string) => plain(text).split(/[^a-z0-9]+/).filter(Boolean);

/** Every word of the keyword (diacritics ignored, 3+ letters) appears in `text`. */
export const containsKeyword = (text: string, keyword: string) => {
  const have = new Set(words(text));
  return words(keyword).filter((word) => word.length >= 3).every((word) => have.has(word));
};

export const pageWordCount = (page: Pick<SeoLandingPage, "intro" | "sections" | "faq">) =>
  words([page.intro, ...page.sections.flatMap((s) => [s.heading, s.html]), ...page.faq.flatMap((f) => [f.question, f.answer])].join(" ")).length;

export type SeoCheck = { id: string; label: string; ok: boolean; tip: string };

/** The on-page basics that help the page climb; shown as a checklist while editing. */
export function seoPageChecks(page: SeoLandingPage): SeoCheck[] {
  const keyword = page.keyword;
  const count = pageWordCount(page);
  return [
    { id: "title", label: "Cuvântul cheie în titlul paginii (title)", ok: containsKeyword(page.seoTitle, keyword), tip: `Pune „${keyword}” în title, cât mai la început.` },
    { id: "title-length", label: "Title de 30–60 de caractere", ok: page.seoTitle.length >= 30 && page.seoTitle.length <= 60, tip: "Google taie titlurile mai lungi de ~60 de caractere." },
    { id: "meta", label: "Meta description de 70–155 de caractere, cu cuvântul cheie", ok: page.metaDescription.length >= 70 && page.metaDescription.length <= 155 && containsKeyword(page.metaDescription, keyword), tip: "Textul de sub titlu în Google: scurt, cu cuvântul cheie și un motiv să dea click." },
    { id: "h1", label: "Cuvântul cheie în H1", ok: containsKeyword(page.h1, keyword), tip: "Titlul mare de pe pagină trebuie să conțină cuvântul cheie." },
    { id: "slug", label: "Cuvântul cheie în adresă (slug)", ok: containsKeyword(page.slug.replace(/-/g, " "), keyword), tip: "Adresa paginii să conțină cuvintele căutate, fără diacritice." },
    { id: "intro", label: "Cuvântul cheie în primul paragraf", ok: containsKeyword(page.intro, keyword), tip: "Primele rânduri spun clar despre ce e pagina." },
    { id: "length", label: `Minim 600 de cuvinte (acum ${count})`, ok: count >= 600, tip: "Paginile din top au de obicei text consistent și util." },
    { id: "sections", label: "Cel puțin 4 secțiuni cu subtitlu", ok: page.sections.filter((s) => s.heading.trim() && s.html.trim()).length >= 4, tip: "Împarte pagina pe subiecte: ce primești, cum lucrăm, zonă, preț/ofertă." },
    { id: "faq", label: "Cel puțin 3 întrebări frecvente", ok: page.faq.filter((f) => f.question.trim() && f.answer.trim()).length >= 3, tip: "Întrebările apar în Google și în răspunsurile AI." },
    { id: "links", label: "Link spre contact sau ofertă", ok: /href="\/(contact|oferta)/.test([page.intro, ...page.sections.map((s) => s.html)].join(" ")), tip: "Un link intern spre /contact sau /oferta/olx ajută și vizitatorul, și Google." },
  ];
}

export const seoPageScore = (page: SeoLandingPage) => {
  const checks = seoPageChecks(page);
  return Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
};
