import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ClauseChecklistEditor, { type ClauseSnapshot } from "src/client/features/admin/components/Contracts/ClauseChecklistEditor";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test-token" } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function Editor({ initial = [] }: { initial?: ClauseSnapshot[] }) {
  const [value, setValue] = useState(initial);
  return <><ClauseChecklistEditor eventType="Nuntă" services={[]} privateClient={false} value={value} onChange={setValue} /><output data-testid="snapshot">{JSON.stringify(value)}</output></>;
}
function writeBody(text: string) {
  const editor = screen.getByRole("textbox", { name: "Text clauză" });
  editor.innerHTML = `<p>${text}</p>`;
  fireEvent.input(editor);
}
test("adds, edits, deselects and removes a custom clause without fetching or calling AI", () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Adaugă clauză" }));
  fireEvent.change(screen.getByLabelText("Titlu clauză"), { target: { value: "Ora de încheiere" } });
  writeBody("Munca se încheie la ora 23:00.");
  const saved = JSON.parse(screen.getByTestId("snapshot").textContent!);
  expect(saved[0]).toMatchObject({ title: "Ora de încheiere", body: "<p>Munca se încheie la ora 23:00.</p>", groupKey: null });
  expect(saved[0].key).toMatch(/^custom:/);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByTestId("snapshot")).toHaveTextContent("[]");
  fireEvent.click(screen.getByRole("button", { name: "Șterge clauza" }));
  expect(screen.queryByLabelText("Titlu clauză")).not.toBeInTheDocument();
  // Only the template list may load; nothing is generated and no AI is called.
  expect(fetchMock.mock.calls.filter(([url]) => !String(url).endsWith("/sets"))).toHaveLength(0);
});
test("preselects the template made for the event type and generates from it", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/sets")) {
      return { ok: true, json: async () => ({ sets: [
        { id: "s-botez", name: "Botez", eventType: "Botez", clauses: [] },
        { id: "s-nunta", name: "Nuntă", eventType: "Nuntă", clauses: [] },
      ] }) };
    }
    return { ok: true, json: async () => ({ clauses: [] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<Editor />);
  const select = await screen.findByLabelText("Șablon clauze");
  await waitFor(() => expect(select).toHaveValue("s-nunta"));
  expect(screen.getByRole("option", { name: "Nuntă — recomandat" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Generează clauzele" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/contract-clause-templates/render", expect.anything()));
  const renderCall = fetchMock.mock.calls.find(([url]) => url.endsWith("/render"))!;
  expect(JSON.parse((renderCall[1] as RequestInit).body as string)).toMatchObject({ setId: "s-nunta", eventType: "Nuntă" });
});
test("restores custom clauses saved in a draft", () => {
  render(<Editor initial={[{ templateId: "custom:1", key: "custom:1", title: "Clauză proprie", body: "<p>Text salvat</p>", order: 10, groupKey: null }]} />);
  expect(screen.getByLabelText("Titlu clauză")).toHaveValue("Clauză proprie");
  expect(screen.getByRole("textbox", { name: "Text clauză" })).toHaveTextContent("Text salvat");
});
test("regenerating library clauses preserves edited custom clauses", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ clauses: [{ templateId: "default", key: "default", title: "Standard", body: "<p>Standard</p>", order: 100, groupKey: null, mutexGroup: null, defaultChecked: true }] }) }));
  render(<Editor initial={[{ templateId: "custom:1", key: "custom:1", title: "Titlu", body: "<p>Original</p>", order: 10, groupKey: null }]} />);
  writeBody("Modificat");
  fireEvent.click(screen.getByRole("button", { name: "Regenerează clauzele" }));
  await waitFor(() => expect(JSON.parse(screen.getByTestId("snapshot").textContent!)).toHaveLength(2));
  expect(JSON.parse(screen.getByTestId("snapshot").textContent!)[1]).toMatchObject({ key: "custom:1", body: "<p>Modificat</p>", order: 101 });
});
