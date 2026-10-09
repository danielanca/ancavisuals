import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ClauseAiRewrite from "src/client/features/admin/components/Contracts/ClauseAiRewrite";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test-token" } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const original = { title: "Ora", body: "<p>terminam la 23</p>" };
const clause = { title: "Ora de încheiere", body: "<p>Activitatea se încheie la ora 23:00.</p>", text: "Activitatea se încheie la ora 23:00." };
test("formalizes only on click, previews and applies only on explicit selection", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ clause }) }); vi.stubGlobal("fetch", fetchMock);
  const onApply = vi.fn(); render(<ClauseAiRewrite {...original} onApply={onApply} />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Fă mai formal cu AI" }));
  expect(await screen.findByText(clause.text)).toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/contract-clause-templates/rewrite", expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" }, body: JSON.stringify({ ...original, mode: "formal" }) }));
  fireEvent.click(screen.getByRole("button", { name: "Aplică propunerea" }));
  expect(onApply).toHaveBeenCalledWith({ title: clause.title, body: clause.body });
});
test("can dismiss a correction while keeping the original", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ clause }) }));
  const onApply = vi.fn(); render(<ClauseAiRewrite {...original} onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Corectează cu AI" }));
  fireEvent.click(await screen.findByRole("button", { name: "Păstrează textul meu" }));
  expect(screen.queryByText("Propunere AI")).not.toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
});
test("does not replace text when AI fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "AI indisponibil" }) }));
  const onApply = vi.fn(); render(<ClauseAiRewrite {...original} onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Corectează cu AI" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI indisponibil");
  expect(onApply).not.toHaveBeenCalled();
});
test("discards a pending proposal if the text changed in the meantime", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(value => { resolve = value; })));
  const onApply = vi.fn(); const { rerender } = render(<ClauseAiRewrite {...original} onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Corectează cu AI" }));
  await waitFor(() => expect(resolve).toBeDefined());
  rerender(<ClauseAiRewrite title="Ora" body="<p>Alt text</p>" onApply={onApply} />);
  resolve({ ok: true, json: async () => ({ clause }) });
  expect(await screen.findByRole("alert")).toHaveTextContent("Ai modificat textul");
  expect(screen.queryByText("Propunere AI")).not.toBeInTheDocument();
  expect(onApply).not.toHaveBeenCalled();
});
