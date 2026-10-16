/*
 * Purpose: the offer template organizer shows photos in the same visual order as the public
 * /oferta gallery — dealt row by row into columns (#1 #2 #3 #4 on the first row), 4 columns
 * for desktop and 2 for mobile — `?device=mobile` opens the mobile list, and photos too heavy
 * for visitors are listed apart, since the site skips them and the next photos move up.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import OfferTemplateOrganizerPage from "src/client/features/admin/components/OfferTemplateOrganizerPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "admin-test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

const asset = (n: number) => ({ id: `a${n}`, serviceId: "photo", kind: "image", url: `https://cdn.test/${n}.jpg`, label: `Poza ${n}` });
const desktop = Array.from({ length: 9 }, (_, i) => asset(i + 1));
const mobile = Array.from({ length: 5 }, (_, i) => asset(i + 1));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(String(url).includes("template-showcase")
      ? { services: [{ id: "photo", label: "Foto", description: "", assets: desktop, assetsMobile: mobile }] }
      : { assets: [] }),
  })));
});

function renderAt(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/template-oferte/:serviceId" element={<OfferTemplateOrganizerPage />} /></Routes></MemoryRouter>);
}
// Numerele #N din fiecare coloană, de sus în jos.
const columnNumbers = (columns: HTMLElement[]) => columns.map((column) => within(column).queryAllByText(/^#\d+$/).map((badge) => badge.textContent));

test("desktop deals photos row by row into 4 columns, like the public gallery", async () => {
  renderAt("/admin/template-oferte/photo");
  const first = await screen.findByText("#1");
  const columns = Array.from(first.closest("article")!.parentElement!.parentElement!.children) as HTMLElement[];
  expect(columns).toHaveLength(4);
  expect(columnNumbers(columns)).toEqual([["#1", "#5", "#9"], ["#2", "#6"], ["#3", "#7"], ["#4", "#8"]]);
});

test("?device=mobile opens the mobile list in 2 columns", async () => {
  renderAt("/admin/template-oferte/photo?device=mobile");
  const first = await screen.findByText("#1");
  const columns = Array.from(first.closest("article")!.parentElement!.parentElement!.children) as HTMLElement[];
  expect(columnNumbers(columns)).toEqual([["#1", "#3", "#5"], ["#2", "#4"]]);
});

test("photos too heavy for visitors are left out of the preview and listed apart", async () => {
  desktop[1] = { ...asset(2), sizeBytes: 2_300_000 } as never;
  renderAt("/admin/template-oferte/photo");
  const first = await screen.findByText("#1");
  const columns = Array.from(first.closest("article")!.parentElement!.parentElement!.children) as HTMLElement[];
  // Poza 2 lipsește pentru vizitatori: poza 3 îi ia locul (#2) și restul urcă.
  expect(columnNumbers(columns)).toEqual([["#1", "#5"], ["#2", "#6"], ["#3", "#7"], ["#4", "#8"]]);
  expect(screen.getByText(/Nu apar pe site/)).toBeInTheDocument();
  expect(screen.getByText("ascunsă · 2,2 MB")).toBeInTheDocument();
  desktop[1] = asset(2) as never;
});
