import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import TodayBriefPage from "src/client/features/client-brief/TodayBriefPage";
import RequireAuth from "src/client/features/admin/components/RequireAuth";
import CheckAuth from "src/client/features/admin/components/CheckAuth";
import { emptyBriefAnswers, getBriefMoments } from "src/shared/clientBrief/clientBrief";
import { loginDestination } from "src/client/features/admin/auth/loginDestination";

const authState = vi.hoisted(() => ({ auth: { authorise: true, loading: false, accessToken: "admin-token" } }));
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => authState }));
beforeEach(() => { authState.auth.authorise = true; });
afterEach(() => vi.unstubAllGlobals());
const brief = {
  clientName: "Ana și Andrei", eventType: "Nuntă", eventDate: "2026-10-06", moments: getBriefMoments("Nuntă"),
  answers: { ...emptyBriefAnswers(), priorities: "Emoțiile și bunicii", importantPeople: "Maria, bunica", groupPhotos: "Cu fiecare familie", schedule: "14:00 la biserică", avoid: "Fără poze regizate", moments: { religious: { presence: "yes", capture: "both", coverage: "full", details: "Toată slujba" }, cake: { presence: "no", capture: "", coverage: "", details: "" } } },
  status: "completed", revision: 1, updatedAt: "2026-10-06T08:00:00Z", submittedAt: "2026-10-06T08:00:00Z",
};
function renderToday() {
  return render(<HelmetProvider><MemoryRouter initialEntries={["/azi"]}><Routes>
    <Route element={<RequireAuth />}><Route path="/azi" element={<TodayBriefPage />} /></Route>
    <Route path="/login" element={<p>Pagina de autentificare</p>} />
  </Routes></MemoryRouter></HelmetProvider>);
}
test("presents actionable client answers, complete ceremony recording and morning reminder", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ day: "2026-10-06", events: [{ id: "wedding", clientName: "Ana și Andrei", eventType: "Nuntă", phone: "0700000000", services: ["Foto", "Video"], brief }] }) });
  vi.stubGlobal("fetch", fetchMock);
  renderToday();
  expect(await screen.findByText("Emoțiile și bunicii")).toBeInTheDocument();
  expect(screen.getByText("Maria, bunica")).toBeInTheDocument();
  expect(screen.getByText("Cu fiecare familie")).toBeInTheDocument();
  expect(screen.getByText(/Filmare: Integral, cu sunet/)).toBeInTheDocument();
  expect(screen.getByText(/De făcut dimineață/)).toHaveTextContent("să îți arate personal persoanele de interes");
  expect(screen.getByText("Nu are loc")).toBeInTheDocument();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.getByRole("link", { name: /Sună clientul/ })).toHaveAttribute("href", "tel:0700000000");
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer admin-token" });
  await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive"));
});
test("handles a day without events and distinguishes a missing brief", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ day: "2026-10-06", events: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ day: "2026-10-06", events: [{ id: "wedding", clientName: "Ana și Andrei", eventType: "Nuntă", phone: "", services: [], brief: null }] }) });
  vi.stubGlobal("fetch", fetchMock);
  renderToday();
  expect(await screen.findByText("Nu ai evenimente confirmate pentru azi.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizează" }));
  expect(await screen.findByText("Acest eveniment nu are încă un brief client.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Creează brief client" })).toBeInTheDocument();
});
test("unauthenticated /azi redirects to sign-in without fetching client information", async () => {
  authState.auth.authorise = false;
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  renderToday();
  expect(await screen.findByText("Pagina de autentificare")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
test("after authentication /login returns to the requested /azi page", async () => {
  render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/azi" } } }]}><Routes>
    <Route element={<CheckAuth />}><Route path="/login" element={<p>Login</p>} /></Route>
    <Route path="/azi" element={<p>Brief-ul de azi</p>} />
  </Routes></MemoryRouter>);
  expect(await screen.findByText("Brief-ul de azi")).toBeInTheDocument();
});
test("login return destination allows internal private pages and rejects external paths", () => {
  expect(loginDestination({ from: { pathname: "/azi" } })).toBe("/azi");
  expect(loginDestination({ from: { pathname: "/admin/events/wedding/brief" } })).toBe("/admin/events/wedding/brief");
  for (const pathname of ["//example.com", "/login", "https://example.com", "/administrator"]) {
    expect(loginDestination({ from: { pathname } })).toBe("/admin");
  }
});
