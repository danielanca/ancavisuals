/*
 * Purpose: an album with nothing in it shows visitors a plain explanation (photos not uploaded yet
 * or a wrong link, with link examples) — no consent pop-up, no "take a screenshot" box, no
 * "try anyway" button. An album with a film but no photos still opens normally.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { consentModalMock } = vi.hoisted(() => ({ consentModalMock: vi.fn(() => null) }));
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { authorise: false } }) }));
vi.mock("src/client/pages/MediaDownload/AncaVisualsPromo", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/Onboardingwizard", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/ProposalLinksPanel", () => ({ default: () => null }));
vi.mock("src/client/pages/MediaDownload/MediaConsentModal", () => ({ default: consentModalMock, MediaRetentionReminder: () => null }));
vi.mock("src/client/pages/MediaDownload/PhotoLightbox", () => ({ default: () => null }));
vi.mock("src/client/pages/DeliveryAddress/AddressList", () => ({ default: () => null }));

import MediaAlbumPage from "src/client/pages/MediaDownload/MediaAlbumPage";
import { isAlbumDateSlug } from "src/client/pages/MediaDownload/EmptyAlbumNotice";

let albumData: Record<string, unknown>;
const renderAlbum = (slug: string) =>
  render(<MemoryRouter initialEntries={[`/media/${slug}`]}><Routes><Route path="/media/:slug" element={<MediaAlbumPage />} /></Routes></MemoryRouter>);

beforeEach(() => {
  consentModalMock.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    /^\/api\/album\/[^/?]+$/.test(url)
      ? { ok: true, json: async () => albumData }
      : { ok: false, json: async () => ({}) }));
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("empty album", () => {
  test("usual link form: photos not uploaded yet, with examples; no pop-up, no screenshot, no 'try anyway'", async () => {
    albumData = { slug: "12septembrie2026", title: "Album", photos: [], originalPhoto: [], featured: [] };
    renderAlbum("12septembrie2026");
    expect(await screen.findByRole("heading", { name: "Pozele nu au fost încărcate încă" })).toBeInTheDocument();
    expect(screen.getByText("ancavisuals.ro/media/3mai2026")).toBeInTheDocument();
    expect(screen.queryByText(/screenshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Încearcă totuși/)).not.toBeInTheDocument();
    expect(consentModalMock).not.toHaveBeenCalled();
  });

  test("another link form: says it may also be a wrong link", async () => {
    albumData = { slug: "nunta-ana", title: "Album", photos: [], originalPhoto: [], featured: [] };
    renderAlbum("nunta-ana");
    expect(await screen.findByRole("heading", { name: /sau linkul este greșit/ })).toBeInTheDocument();
  });

  test("a film but no photos is not empty: the album opens", async () => {
    albumData = { slug: "12septembrie2026", title: "Album cu film", photos: [], originalPhoto: [], featured: [], shortvideo: "https://cdn.test/v.mp4" };
    renderAlbum("12septembrie2026");
    expect(await screen.findByRole("heading", { name: "Album cu film" })).toBeInTheDocument();
    expect(screen.queryByText(/nu au fost încărcate/)).not.toBeInTheDocument();
  });

  test("link form check", () => {
    expect(isAlbumDateSlug("12septembrie2026")).toBe(true);
    expect(isAlbumDateSlug("08August2026")).toBe(true);
    expect(isAlbumDateSlug("nunta-ana")).toBe(false);
    expect(isAlbumDateSlug("12sept2026")).toBe(false);
  });
});
