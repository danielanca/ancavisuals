import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import FeedbackAdminPage from "src/client/features/feedback/FeedbackAdminPage";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "admin-test" } }) }));
const fetchMock = vi.fn();
const item = { id: "feedback-request-0001", albumSlug: "2026", name: "Ana", message: "Feedback client", createdAt: "2026-10-07T10:00:00.000Z", read: false };
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
function page() { render(<MemoryRouter><FeedbackAdminPage /></MemoryRouter>); }
test("loads owner inbox and marks read only after server confirms", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: [item], nextCursor: null }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Salvarea a eșuat" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  page(); await screen.findByText("Feedback client");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer admin-test");
  expect(screen.getByRole("link", { name: "Acceptă ca recenzie" })).toHaveAttribute("href", "/admin/recenzii");
  fireEvent.click(screen.getByRole("button", { name: "Marchează citit" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Salvarea a eșuat");
  expect(screen.getByText("Nou")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Marchează citit" }));
  await screen.findByText("Feedback client");
  await vi.waitFor(() => expect(screen.queryByText("Nou")).not.toBeInTheDocument());
});
test("published feedback links to review management instead of offering duplicate acceptance", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: [{ ...item, publishedReviewId: "feedback-review" }], nextCursor: null }) });
  page(); await screen.findByText("Ana");
  expect(screen.getByRole("link", { name: "Acceptat ca recenzie · Editează (draft / publicare + poze)" })).toHaveAttribute("href", "/admin/recenzii?edit=feedback-review");
  expect(screen.queryByRole("link", { name: "Acceptă ca recenzie" })).not.toBeInTheDocument();
});
test("loads older feedback using the server cursor without duplicating existing entries", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: [item], nextCursor: item.id }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: [item, { ...item, id: "feedback-request-0002", name: "Andrei" }], nextCursor: null }) });
  page(); await screen.findByText("Ana");
  fireEvent.click(screen.getByRole("button", { name: "Încarcă mesajele mai vechi" }));
  await screen.findByText("Andrei");
  expect(screen.getAllByText("Feedback client")).toHaveLength(2);
  expect(fetchMock.mock.calls[1][0]).toContain(`cursor=${item.id}`);
});
