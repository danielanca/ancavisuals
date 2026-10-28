/*
 * Purpose: /admin/seo-radar/pagina — from an absent keyword: Google results → AI analysis with
 * questions → the owner's answers go to the AI → editable page with SEO score → publish.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import SeoPageCreatorPage from "src/client/features/admin/components/SeoPageCreatorPage";

afterEach(() => vi.unstubAllGlobals());

const context = { keyword: "fotocabina Dej", city: "Dej", capturedAt: "2026-10-27T10:00:00Z", ownPosition: null, results: [{ position: 1, title: "Fotocabina X Dej", url: "https://x.ro", domain: "x.ro", snippet: "" }], pages: ["/contact"] };
const plan = { intent: "Caută fotocabină pentru nuntă", competitors: "Liste de firme", angle: "Ce primești concret", slug: "fotocabina-dej", seoTitle: "Fotocabina Dej", metaDescription: "m", h1: "Fotocabină Dej", outline: ["Ce primiți"], secondaryKeywords: ["photobooth dej"], questions: ["De la ce preț?"] };
const written = { slug: "fotocabina-dej", keyword: "fotocabina Dej", city: "Dej", seoTitle: "Fotocabina Dej pentru nunți | Anca Visuals", metaDescription: "Fotocabină în Dej.", h1: "Fotocabină în Dej", subtitle: "", intro: "<p>Fotocabina Dej</p>", sections: [{ heading: "Ce primiți", html: '<p><a href="/contact">contact</a></p>' }], faq: [] };

test("analyze, answer, write with AI, publish", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.startsWith("/api/admin/seo-pages/context")) return { ok: true, json: async () => ({ context, page: null }) };
    if (url === "/api/admin/seo-pages/plan") return { ok: true, json: async () => ({ plan }) };
    if (url === "/api/admin/seo-pages/write") return { ok: true, json: async () => ({ page: written }) };
    if (url === "/api/admin/seo-pages") return { ok: true, json: async () => ({ page: { ...body.page, status: body.status, publishedAt: "2026-10-28T10:00:00Z", updatedAt: "" } }) };
    throw new Error(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);

  render(
    <MemoryRouter initialEntries={["/admin/seo-radar/pagina?keyword=fotocabina%20Dej&city=Dej"]}>
      <Routes><Route path="/admin/seo-radar/pagina" element={<SeoPageCreatorPage />} /></Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Fotocabina X Dej")).toBeInTheDocument();
  expect(screen.getByText(/Nu apărem în primele 10 rezultate/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "🔎 Analizează cu AI" }));
  fireEvent.change(await screen.findByLabelText("De la ce preț?"), { target: { value: "de la 300 €" } });
  fireEvent.click(screen.getByRole("button", { name: "✍️ Scrie pagina cu AI" }));
  expect(await screen.findByDisplayValue("Fotocabină în Dej")).toBeInTheDocument();
  const writeBody = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/admin/seo-pages/write")![1]!.body));
  expect(writeBody.answers).toEqual([{ question: "De la ce preț?", answer: "de la 300 €" }]);
  expect(screen.getByRole("region", { name: "Scor SEO" }).textContent).toMatch(/\d+%/);

  fireEvent.click(screen.getByRole("button", { name: "🚀 Publică pagina" }));
  await waitFor(() => expect(screen.getByText(/Publicată!/)).toBeInTheDocument());
  const saveBody = JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/admin/seo-pages")![1]!.body));
  expect(saveBody).toMatchObject({ status: "published", page: { slug: "fotocabina-dej", keyword: "fotocabina Dej" } });
  expect(screen.getByRole("link", { name: "https://ancavisuals.ro/servicii/fotocabina-dej ↗" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Deschide Search Console ↗" }).getAttribute("href")).toContain(encodeURIComponent("https://ancavisuals.ro/servicii/fotocabina-dej"));
});
