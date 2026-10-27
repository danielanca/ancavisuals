/*
 * Purpose: the public selection page behind a personal link — the person's name is filled in,
 * the name works as a username (same name → back where they left off), the burst-photos note shows.
 */
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ProposalLinkPage from "src/client/pages/MediaDownload/ProposalLinkPage";

const photos = Array.from({ length: 130 }, (_, index) => ({ fileName: `IMG_${index + 1}.jpg`, previewUrl: `https://cdn.test/IMG_${index + 1}.webp` }));
const calls: { url: string; body?: any }[] = [];
let visitorReply: Record<string, unknown> = {};

beforeEach(() => {
  calls.length = 0;
  window.localStorage.clear();
  (globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
    if (url.endsWith("/visitor")) return json(visitorReply);
    if (url.includes("/proposals?")) return json({ fileNames: ["IMG_2"] });
    if (url.endsWith("/progress")) return json({ ok: true });
    return json({ albumSlug: "08august2026", title: "08august2026", label: "Estera", personName: "Estera", photos });
  }) as any;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderPage = () => render(
  <MemoryRouter initialEntries={["/propune/token123456789012"]}>
    <Routes><Route path="/propune/:token" element={<ProposalLinkPage />} /></Routes>
  </MemoryRouter>,
);

test("a returning name continues where it left off, with earlier picks marked", async () => {
  visitorReply = { visitorId: "existing-visitor", name: "Estera", viewedCount: 100 };
  renderPage();
  const input = await screen.findByPlaceholderText("Numele tău");
  expect(input).toHaveValue("Estera");
  fireEvent.click(screen.getByRole("button", { name: "Începe" }));

  expect(await screen.findByText("Bine ai revenit! Continui de la poza 100 din 130.")).toBeInTheDocument();
  expect(calls.find(call => call.url.endsWith("/visitor"))!.body).toMatchObject({ name: "Estera" });
  // Enough photos are loaded to reach photo 100, and it's scrolled into view.
  await waitFor(() => expect(document.querySelector('[data-index="99"]')).not.toBeNull());
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  // Earlier picks are loaded under the existing visitor's id.
  await waitFor(() => expect(calls.some(call => call.url.includes("visitorId=existing-visitor"))).toBe(true));
  expect(screen.getByRole("button", { name: "Deja propusă" })).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("proposalLink:token123456789012")!)).toEqual({ visitorId: "existing-visitor", name: "Estera" });
});

test("a new name starts at the beginning; the burst note asks to tick every frame", async () => {
  visitorReply = { visitorId: "fresh-visitor", name: "Ana", viewedCount: 0 };
  renderPage();
  const input = await screen.findByPlaceholderText("Numele tău");
  fireEvent.change(input, { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: "Începe" }));
  expect(await screen.findByText("Salut, Ana!")).toBeInTheDocument();
  expect(screen.queryByText(/Bine ai revenit/)).not.toBeInTheDocument();
  expect(screen.getByRole("note").textContent).toContain("bifează-le pe toate");
});
