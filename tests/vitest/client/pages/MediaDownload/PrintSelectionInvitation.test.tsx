import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MediaAlbumPage from "src/client/pages/MediaDownload/MediaAlbumPage";
import PrintSelectionLink from "src/client/pages/MediaDownload/PrintSelectionLink";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { authorise: false } }) }));
vi.mock("src/client/pages/MediaDownload/AncaVisualsPromo", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/Onboardingwizard", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/ProposalLinksPanel", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/MediaConsentModal", () => ({ default: () => null, MediaRetentionReminder: () => null }));
vi.mock("src/client/pages/MediaDownload/PhotoLightbox", () => ({ default: () => null }));
vi.mock("src/client/pages/DeliveryAddress/AddressList", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/DeliveryForm", () => ({ default: () => <div role="dialog">Adresa de livrare</div> }));
vi.mock("src/client/pages/Portfolio/BunnyPhotoGallery", () => ({
  default: ({ photos, selectable, onToggle, getKey, selected }: {
    photos: string[]; selectable: boolean; onToggle: (src: string) => void; getKey: (src: string) => string; selected: Set<string>;
  }) => <div>{photos.map(src => <button key={src} disabled={!selectable} aria-pressed={selected?.has(getKey(src)) ?? false} onClick={() => onToggle(src)}>{src.split("/").pop()}</button>)}</div>,
}));
const photos = Array.from({ length: 35 }, (_, i) => `https://cdn.test/photos_preview/photo-${i + 1}.webp`);
let saved: string[];
let saveFailure: boolean;
const fetchMock = vi.fn();
const renderAlbum = (query = "?select=print") => render(<MemoryRouter initialEntries={[`/media/16august2026${query}`]}><Routes><Route path="/media/:slug" element={<MediaAlbumPage />} /></Routes></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  saved = [];
  saveFailure = false;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/print-selection")) {
      if (!saveFailure) saved = JSON.parse(options!.body as string).items;
      return { ok: !saveFailure };
    }
    if (url === "/api/album/16august2026") return { ok: true, json: async () => ({
      slug: "16august2026", title: "Album test", photos, originalPhoto: [], featured: [], print: saved,
    }) };
    return { ok: false, json: async () => ({}) };
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("invitation explains real buttons, preserves choices across pages and saves to the existing album", async () => {
  renderAlbum();
  expect(await screen.findByRole("heading", { name: "Alegeți cele 100 de fotografii pentru imprimare" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Începe selecția" }));
  fireEvent.click(screen.getByRole("button", { name: "photo-1.webp" }));
  expect(screen.getAllByRole("status").some(node => node.textContent?.includes("1 / 100"))).toBe(true);
  fireEvent.click(screen.getAllByRole("button", { name: /Următorul/ })[0]);
  fireEvent.click(await screen.findByRole("button", { name: "photo-31.webp" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Salvează selecția (2)" })[0]);
  await waitFor(() => expect(saved).toEqual(["photo-1.webp", "photo-31.webp"]));
  expect(await screen.findByText(/Selecția a fost salvată/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continuă selecția" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Completează adresa de livrare" })[0]);
  expect(screen.getByRole("dialog")).toHaveTextContent("Adresa de livrare");
});

test("failed save retains selected photos and shows retry error instead of success", async () => {
  saveFailure = true;
  renderAlbum();
  fireEvent.click(await screen.findByRole("button", { name: "Începe selecția" }));
  fireEvent.click(screen.getByRole("button", { name: "photo-1.webp" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Salvează selecția (1)" })[0]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Nu am putut salva selecția");
  expect(screen.getByRole("button", { name: "photo-1.webp" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText(/Selecția a fost salvată/)).not.toBeInTheDocument();
});

test("returning through invitation preserves a draft already in print mode", async () => {
  localStorage.setItem("av:album:16august2026:state", JSON.stringify({ v: 3, mode: "print", browsePage: 1, printPage: 1, downloadPage: 1, selectedPrint: ["photo-1.webp"], selectedDownload: [] }));
  renderAlbum();
  expect(await screen.findByRole("heading", { name: /Alegeți cele 100/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "photo-1.webp" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByRole("button", { name: "Salvează selecția (1)" })).toHaveLength(2);
});

test("regular album link also shows the print selection guide under the action hub", async () => {
  renderAlbum("");
  await screen.findByRole("heading", { name: "Album test" });
  expect(screen.getByRole("heading", { name: /Alegeți cele 100/ })).toBeInTheDocument();
});

test("admin copy uses production origin and exposes a manual fallback", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<PrintSelectionLink albumSlug="16august2026" />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/media/16august2026?select=print");
  fireEvent.click(screen.getByRole("button", { name: "Copiază link alegere 100 de poze" }));
  await screen.findByRole("button", { name: "Link copiat" });
  expect(writeText).toHaveBeenCalledWith("https://ancavisuals.ro/media/16august2026?select=print");
  writeText.mockRejectedValueOnce(new Error("denied"));
  fireEvent.click(screen.getByRole("button", { name: "Link copiat" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("https://ancavisuals.ro/media/16august2026?select=print");
});
