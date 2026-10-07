import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, expect, test, vi } from "vitest";
import FeedbackPage from "src/client/features/feedback/FeedbackPage";

function page() { render(<HelmetProvider><MemoryRouter initialEntries={["/media/2026/feedback"]}><Routes><Route path="/media/:slug/feedback" element={<FeedbackPage />} /></Routes></MemoryRouter></HelmetProvider>); }
function fill() {
  fireEvent.change(screen.getByRole("textbox", { name: "Numele tău" }), { target: { value: "Ana" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Câteva cuvinte despre experiența ta" }), { target: { value: "Poze frumoase, livrare lentă" } });
}
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: () => "00000000-0000-4000-8000-000000000001" });
});
test("generates 7 choices, submits only edited chosen text, and does not submit while generating", async () => {
  const variants = Array.from({ length: 7 }, (_, index) => `Text propus ${index + 1}`);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ variants }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  page(); fill(); fireEvent.click(screen.getByRole("button", { name: "Ajută-mă să formulez cu AI" }));
  expect(await screen.findAllByRole("radio")).toHaveLength(7);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/feedback/2026/variants");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: "Poze frumoase, livrare lentă" });
  fireEvent.click(screen.getByRole("radio", { name: "Varianta 5" }));
  expect(screen.getByRole("textbox", { name: "Câteva cuvinte despre experiența ta" })).toHaveValue("Text propus 5");
  fireEvent.change(screen.getByRole("textbox", { name: "Câteva cuvinte despre experiența ta" }), { target: { value: "Textul ales, editat de mine" } });
  fireEvent.click(screen.getByRole("button", { name: "Trimite feedback-ul" }));
  expect(await screen.findByText("Mulțumim pentru feedback!")).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/feedback/2026");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ name: "Ana", message: "Textul ales, editat de mine" });
});
test("AI errors retain original text and manual submission still works", async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "AI indisponibil" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  page(); fill(); fireEvent.click(screen.getByRole("button", { name: "Ajută-mă să formulez cu AI" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI indisponibil");
  expect(screen.getByRole("textbox", { name: "Câteva cuvinte despre experiența ta" })).toHaveValue("Poze frumoase, livrare lentă");
  fireEvent.click(screen.getByRole("button", { name: "Trimite feedback-ul" }));
  expect(await screen.findByText("Mulțumim pentru feedback!")).toBeInTheDocument();
});
test("retries with the same ID after ambiguous network failure and preserves both fields", async () => {
  fetchMock.mockRejectedValueOnce(new Error("Conexiune pierdută")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  page(); fill(); fireEvent.click(screen.getByRole("button", { name: "Trimite feedback-ul" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Conexiune pierdută");
  expect(screen.getByRole("textbox", { name: "Numele tău" })).toHaveValue("Ana");
  fireEvent.click(screen.getByRole("button", { name: "Trimite feedback-ul" }));
  await screen.findByText("Mulțumim pentru feedback!");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).requestId).toBe(JSON.parse(fetchMock.mock.calls[1][1].body).requestId);
});
test("prevents repeated generation/submission until the pending request ends", async () => {
  let finish: (value: unknown) => void = () => {};
  fetchMock.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  page(); fill();
  fireEvent.click(screen.getByRole("button", { name: "Ajută-mă să formulez cu AI" }));
  expect(screen.getByRole("button", { name: "Trimite feedback-ul" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Câteva cuvinte despre experiența ta" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  finish({ ok: true, json: async () => ({ variants: Array.from({ length: 7 }, (_, index) => `Text ${index}`) }) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Trimite feedback-ul" })).toBeEnabled());
});
