/*
 * Purpose: the Dashboard guide sends the admin page list with the question and turns links to
 * known admin pages in the reply into in-app links (unknown paths stay plain text); the mic button
 * dictates the question into the field.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminGuideChat from "src/client/features/admin/components/AdminGuideChat";

// jsdom has no Element.scrollTo (the chat scrolls to the newest message).
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

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

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).webkitSpeechRecognition;
});

describe("AdminGuideChat", () => {
  test("asks the guide endpoint and links the pages it names", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Mergi la [Prețuri de pornire](/admin/preturi#date-ocupate) sau [altceva](/admin/nu-exista)." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><AdminGuideChat accessToken="token" /></MemoryRouter>);
    // Open from the start, greeting already on screen.
    expect(screen.getByText("Cu ce te pot ajuta?")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/unde schimb prețurile/), { target: { value: "unde sunt datele ocupate?" } });
    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));

    const link = await screen.findByRole("link", { name: "Prețuri de pornire" });
    expect(link).toHaveAttribute("href", "/admin/preturi#date-ocupate");
    expect(screen.queryByRole("link", { name: "altceva" })).not.toBeInTheDocument();
    expect(screen.getByText(/\[altceva\]\(\/admin\/nu-exista\)/)).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/ai-assistant/guide");
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([{ role: "user", content: "unde sunt datele ocupate?" }]);
    expect(body.pages).toEqual(expect.arrayContaining([expect.objectContaining({ path: "/admin/preturi", label: "Prețuri de pornire" })]));
  });

  test("dictates the question with the mic and stops listening on send", async () => {
    (window as any).webkitSpeechRecognition = FakeRecognition;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: "Aici." }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter><AdminGuideChat accessToken="token" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Dictează" }));
    const recognition = FakeRecognition.last!;
    expect(recognition.lang).toBe("ro-RO");
    expect(screen.getByRole("button", { name: "Oprește dictarea" })).toHaveAttribute("aria-pressed", "true");

    act(() => recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "unde trimit sms" } }] }));
    act(() => recognition.onresult({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: "clienților" } }, { isFinal: true, 0: { transcript: "clienților" } }] }));
    expect(screen.getByPlaceholderText(/unde schimb prețurile/)).toHaveValue("Unde trimit sms clienților");

    fireEvent.click(screen.getByRole("button", { name: "Trimite" }));
    expect(recognition.stop).toHaveBeenCalled();
    await screen.findByText("Aici.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: "user", content: "Unde trimit sms clienților" }]);
  });
});
