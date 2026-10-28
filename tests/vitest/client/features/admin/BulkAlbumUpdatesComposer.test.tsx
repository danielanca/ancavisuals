/*
 * Purpose: the "Noutăți în masă" composer never loses a message the owner wrote — a template click
 * asks first and keeps the old text recoverable, a new date doesn't overwrite it, the draft survives a
 * reload (localStorage) — and the mic dictates into the message.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BulkAlbumUpdatesPage from "src/client/features/admin/components/BulkAlbumUpdatesPage";

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

const renderPage = () => render(<MemoryRouter><BulkAlbumUpdatesPage /></MemoryRouter>);
const message = () => document.getElementById("bulk-update-text") as HTMLTextAreaElement;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ albums: [] }) }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as any).webkitSpeechRecognition;
});

describe("BulkAlbumUpdatesPage composer", () => {
  test("asks before a template replaces the owner's text and can bring it back", () => {
    renderPage();
    const templateText = message().value;
    expect(templateText).not.toBe("");

    fireEvent.change(message(), { target: { value: "Mesajul meu scris de mână" } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /Am început editarea/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(message().value).toBe("Mesajul meu scris de mână");

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: /Am început editarea/ }));
    expect(message().value).not.toBe("Mesajul meu scris de mână");

    fireEvent.click(screen.getByRole("button", { name: /Recuperează mesajul meu/ }));
    expect(message().value).toBe("Mesajul meu scris de mână");
  });

  test("a new date keeps the owner's text; the template text with the date is one click away", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Estimare de predare/ }));
    fireEvent.change(message(), { target: { value: "Text personal" } });
    fireEvent.change(screen.getByLabelText(/Data estimată/), { target: { value: "2099-12-20" } });
    expect(message().value).toBe("Text personal");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Pune textul șablonului cu data aleasă/ }));
    expect(message().value).toMatch(/20 decembrie/);
  });

  test("keeps the written message in localStorage across a reload", () => {
    const { unmount } = renderPage();
    fireEvent.change(message(), { target: { value: "Ciorna mea" } });
    unmount();

    renderPage();
    expect(message().value).toBe("Ciorna mea");
  });

  test("dictates into the message", () => {
    (window as any).webkitSpeechRecognition = FakeRecognition;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Scriu eu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dictează mesajul" }));
    act(() => FakeRecognition.last!.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "pozele vin mâine" } }] }));
    expect(message().value).toBe("Pozele vin mâine");
  });

  test("shows exactly what the client gets, without the unsubscribe link unless ticked", async () => {
    const album = { slug: "08august2026", clients: ["Ana", "Ion"], eventDate: "2026-08-08", subscribers: 2, lastUpdate: null };
    const preview = { emailSubject: "[Mesaj automat] ⏳ Termen actualizat", emailHtml: "<p>Bună ziua!</p>", sms: "Buna ziua! Mai dureaza putin.", smsParts: 1, whatsapp: "Bună ziua! ⏳ Mai durează puțin." };
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url.includes("updates-preview") ? preview : { albums: [album] }) }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Selectează Ana & Ion" }));

    expect(await screen.findByText(/\[Mesaj automat\] ⏳ Termen actualizat/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByTitle("Emailul clientului")).toHaveAttribute("srcdoc", expect.stringContaining("<p>Bună ziua!</p>"));
    const previewBody = () => JSON.parse(fetchMock.mock.calls.filter(([url]) => url.includes("updates-preview")).at(-1)![1].body);
    expect(previewBody()).toEqual(expect.objectContaining({ slug: "08august2026", unsubscribeLink: false }));

    fireEvent.click(screen.getByRole("tab", { name: "SMS" }));
    expect(screen.getByTestId("preview-sms")).toHaveTextContent("Buna ziua! Mai dureaza putin.");
    expect(screen.getByText(/1 SMS de abonat/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp" }));
    expect(screen.getByTestId("preview-whatsapp")).toHaveTextContent("Bună ziua! ⏳ Mai durează puțin.");

    fireEvent.click(screen.getByRole("checkbox", { name: /Adaugă linkul de dezabonare/ }));
    await waitFor(() => expect(previewBody().unsubscribeLink).toBe(true), { timeout: 2000 });
  });
});
