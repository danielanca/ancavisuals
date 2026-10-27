/*
 * Purpose: the admin text bar shows on long text fields (not on inputs or opted-out fields),
 * dictates into a textarea and into the clause editor, and "✨ Înfrumusețează" replaces the text
 * through the page's own onChange, with ↩ undo.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminTextAssist, { appendSpoken } from "src/client/features/admin/components/AdminTextAssist";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: any = null;
  onerror: any = null;
  onend: any = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() { FakeRecognition.last = this; }
}

function Page() {
  const [notes, setNotes] = useState("");
  return (
    <>
      <textarea aria-label="Notițe" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p data-testid="state">{notes}</p>
      <input aria-label="Titlu" />
      <textarea aria-label="HTML" data-text-assist="off" />
      <AdminTextAssist />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).webkitSpeechRecognition;
});

describe("AdminTextAssist", () => {
  test("appears only on text areas that allow it", () => {
    render(<Page />);
    fireEvent.focusIn(screen.getByLabelText("Titlu"));
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    fireEvent.focusIn(screen.getByLabelText("HTML"));
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    fireEvent.focusIn(screen.getByLabelText("Notițe"));
    expect(screen.getByRole("toolbar", { name: "Ajutor pentru text" })).toBeInTheDocument();
  });

  test("dictates into the field's React state", () => {
    (window as any).webkitSpeechRecognition = FakeRecognition;
    render(<Page />);
    fireEvent.focusIn(screen.getByLabelText("Notițe"));
    fireEvent.click(screen.getByRole("button", { name: /Dictează/ }));
    act(() => FakeRecognition.last!.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "sună clientul" } }] }));
    expect(screen.getByTestId("state")).toHaveTextContent("Sună clientul");
  });

  test("polishes with AI and can undo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Sună clientul mâine." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<Page />);
    const notes = screen.getByLabelText("Notițe");
    fireEvent.change(notes, { target: { value: "suna clientu maine" } });
    fireEvent.focusIn(notes);
    fireEvent.click(screen.getByRole("button", { name: /Înfrumusețează/ }));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("Sună clientul mâine."));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/ai-assistant/polish");
    expect(JSON.parse(init.body)).toEqual({ text: "suna clientu maine", format: "plain", field: "Notițe" });

    fireEvent.click(screen.getByRole("button", { name: /Anulează/ }));
    expect(screen.getByTestId("state")).toHaveTextContent("suna clientu maine");
  });

  test("continues the last paragraph of the clause editor", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.innerHTML = "<p>Prestatorul livrează pozele</p>";
    expect(appendSpoken(editor, "în 30 de zile")).toBe("<p>Prestatorul livrează pozele în 30 de zile</p>");
    editor.innerHTML = "";
    expect(appendSpoken(editor, "clauza nouă")).toBe("<p>Clauza nouă</p>");
  });
});
