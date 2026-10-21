/*
 * Purpose: the Dashboard guide sends the admin page list with the question and turns links to
 * known admin pages in the reply into in-app links (unknown paths stay plain text).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminGuideChat from "src/client/features/admin/components/AdminGuideChat";

// jsdom has no Element.scrollTo (the chat scrolls to the newest message).
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

afterEach(() => vi.unstubAllGlobals());

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
});
