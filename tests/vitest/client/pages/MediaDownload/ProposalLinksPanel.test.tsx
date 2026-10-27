/*
 * Purpose: album panel for selection links — people come from their profiles (name, email, phone),
 * a new person can be added, and a personal link has „Trimite reminder acum”.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ProposalLinksPanel from "src/client/pages/MediaDownload/ProposalLinksPanel";

const requests: { url: string; method: string; body?: any }[] = [];
const link = {
  token: "tok", label: "Estera", reviewerId: "estera", active: true, url: "/propune/tok", createdAt: "2026-10-03T10:00:00Z",
  status: "in_progress", completedAt: null, totalPhotos: 1279, reminderCount: 0, lastReminderAt: null, lastReminderChannels: [],
  visitors: [{ id: "v", name: "Estera", viewedCount: 141, proposedCount: 0, lastSeenAt: "2026-10-03T14:31:00Z", completedAt: null }], photos: [],
};

beforeEach(() => {
  requests.length = 0;
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data }) as Response;
    if (url.endsWith("/admin/reviewers") && method === "GET") return json({ reviewers: [
      { id: "daniel", name: "Daniel", email: "d@test.com", phone: "" },
      { id: "estera", name: "Estera", email: "e@test.com", phone: "+40745123456" },
    ] });
    if (url.endsWith("/admin/reviewers") && method === "POST") return json({ reviewer: { id: "ana", ...body } });
    if (url.endsWith("/reminder")) return json({ ok: true, channels: ["email", "sms"], errors: [] });
    if (url.includes("/admin?albumSlug=")) return json({ links: [link] });
    return json({});
  }) as any;
});
afterEach(cleanup);

test("adding a new person saves the profile and selects them for the link", async () => {
  render(<ProposalLinksPanel slug="08august2026" accessToken="t" />);
  const select = screen.getByRole("combobox", { name: "Persoana pentru linkul de selecție" });
  await screen.findByRole("option", { name: "Estera" });
  fireEvent.change(select, { target: { value: "__new__" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Nume" }), { target: { value: "Ana" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "ana@test.com" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Telefon" }), { target: { value: "0745000111" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  await waitFor(() => expect(select).toHaveValue("ana"));
  expect(requests.find(request => request.method === "POST")!.body).toEqual({ name: "Ana", email: "ana@test.com", phone: "0745000111" });
  expect(screen.getByText(/ana@test\.com/)).toBeInTheDocument();
});

test("a person without a phone is flagged; the personal link sends a reminder", async () => {
  render(<ProposalLinksPanel slug="08august2026" accessToken="t" />);
  await screen.findByRole("option", { name: "Daniel" });
  fireEvent.change(screen.getByRole("combobox", { name: "Persoana pentru linkul de selecție" }), { target: { value: "daniel" } });
  expect(screen.getByText("fără telefon")).toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: "⏰ Trimite reminder acum" }));
  expect(await screen.findByText("✓ Reminder trimis pe email + SMS.")).toBeInTheDocument();
  expect(requests.some(request => request.url === "/api/proposal-links/admin/tok/reminder" && request.method === "POST")).toBe(true);
});
