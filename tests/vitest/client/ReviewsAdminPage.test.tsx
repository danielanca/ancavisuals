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
  expect(options.body.get("status")).toBe("published");
});

test("feedback can be accepted as a draft", async () => {
  render(<MemoryRouter initialEntries={[{ pathname: "/admin/recenzii", state: { feedback } }]}><ReviewsAdminPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Acceptă ca draft" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options.method === "POST")).toBe(true));
  const [, options] = fetchMock.mock.calls.find(([, options]) => options.method === "POST")!;
  expect(options.body.get("status")).toBe("draft");
  expect(options.body.get("sourceFeedbackId")).toBe(feedback.id);
});

test("lists drafts separately and toggles publication from the list", async () => {
  const review = (id: string, author: string, status: "draft" | "published") => ({ id, author, status, date: "2026-10-01", rating: 5, text: `Text ${author}`, photos: [], verified: false, category: "wedding", offerSlug: null });
  fetchMock.mockImplementation(async (_url, options) => options?.method === "PUT"
    ? { ok: true, json: async () => ({ review: {} }) }
    : { ok: true, json: async () => ({ reviews: [review("r1", "Ana", "draft"), review("r2", "Ion", "published")] }) });
  render(<MemoryRouter><ReviewsAdminPage /></MemoryRouter>);

  expect(await screen.findByText("Draft · nu apare pe site")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Draft (1)" }));
  expect(screen.getByText("Ana")).toBeInTheDocument();
  expect(screen.queryByText("Ion")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Publică" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(true));
  const [url, options] = fetchMock.mock.calls.find(([, options]) => options?.method === "PUT")!;
  expect(url).toBe("/api/reviews/admin/r1");
  expect(options.body.get("status")).toBe("published");
  expect(await screen.findByText("Nicio recenzie în draft.")).toBeInTheDocument();
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

test("allows selecting up to 15 client photos", async () => {
  render(<MemoryRouter><ReviewsAdminPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Adaugă recenzie" }));

  expect(screen.getByText("Poze de la client (opțional, maximum 15)")).toBeInTheDocument();
  expect(screen.getByText("0/15")).toBeInTheDocument();
});
