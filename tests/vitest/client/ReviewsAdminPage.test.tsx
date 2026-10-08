import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import ReviewsAdminPage from "src/client/features/admin/components/ReviewsAdminPage";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "admin-test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));
const fetchMock = vi.fn();
const feedback = { id: "feedback-request-0001", name: "Ana", message: "Feedback original", createdAt: "2026-10-07T10:00:00Z", albumSlug: "2026", read: false };
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ reviews: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});

test("accepting feedback opens an editable draft and publishes only when the owner submits", async () => {
  render(<MemoryRouter initialEntries={[{ pathname: "/admin/recenzii", state: { feedback } }]}><ReviewsAdminPage /></MemoryRouter>);
  expect(await screen.findByDisplayValue("Ana")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Feedback original")).toBeInTheDocument();
  expect(screen.getByText("Fără rating")).toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([, options]) => !options.method)).toBe(true);
  fireEvent.change(screen.getByDisplayValue("Feedback original"), { target: { value: "Text public verificat" } });
  fireEvent.click(screen.getByRole("button", { name: "Acceptă și publică recenzia" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options.method === "POST")).toBe(true));
  const [url, options] = fetchMock.mock.calls.find(([, options]) => options.method === "POST")!;
  expect(url).toBe("/api/reviews/admin");
  expect(options.body.get("sourceFeedbackId")).toBe(feedback.id);
  expect(options.body.get("text")).toBe("Text public verificat");
  expect(options.body.get("rating")).toBe("0");
  expect(options.body.get("category")).toBe("both");
  expect(options.body.get("offerSlug")).toBe("olx");
});

test("manual creation remains available and a failed acceptance keeps the draft for correction", async () => {
  fetchMock.mockImplementation(async (_url, options) => options.method === "POST"
    ? { ok: false, json: async () => ({ error: "Feedback deja publicat" }) }
    : { ok: true, json: async () => ({ reviews: [] }) });
  render(<MemoryRouter initialEntries={[{ pathname: "/admin/recenzii", state: { feedback } }]}><ReviewsAdminPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Acceptă și publică recenzia" }));
  expect(await screen.findByText("Feedback deja publicat")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Feedback original")).toBeInTheDocument();
});
