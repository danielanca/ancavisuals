/*
 * Purpose: the end-of-page "Povestiți-ne despre ziua voastră" block opens the Tidio chat (whose own
 * launcher is hidden) and logs the intent in the live panel.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

let status: "online" | "offline" = "online";
vi.mock("src/client/features/chat/components/LiveChat", () => ({
  openLiveChat: vi.fn(() => Promise.resolve(true)),
  loadTidio: vi.fn(),
  subscribeToLiveChatStatus: (callback: (value: string) => void) => { callback(status); return () => {}; },
}));
vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));

import ChatWithUs from "src/client/features/chat/components/ChatWithUs";
import { openLiveChat } from "src/client/features/chat/components/LiveChat";
import { sendLiveEvent } from "src/client/utils/liveEvent";

describe("ChatWithUs", () => {
  afterEach(() => { status = "online"; });

  test("opens the live chat and offers WhatsApp as a fallback", () => {
    render(<ChatWithUs />);
    expect(screen.getByRole("heading", { name: /Povestiți-ne despre ziua voastră/ })).toBeInTheDocument();
    expect(screen.getByText("Suntem online")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scrie-ne acum/ }));
    expect(openLiveChat).toHaveBeenCalledTimes(1);
    expect(sendLiveEvent).toHaveBeenCalledWith("chat_opened", expect.anything());

    expect(screen.getByRole("link", { name: /sau pe WhatsApp/ }).getAttribute("href")).toContain("wa.me/40745469907");
  });

  test("shows offline when nobody is available in the Tidio app", () => {
    status = "offline";
    render(<ChatWithUs />);
    expect(screen.getByText("Suntem offline")).toBeInTheDocument();
    expect(screen.getByText(/vă răspundem imediat ce revenim online/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scrie-ne acum/ })).toBeInTheDocument();
  });

  test("on the owner's device it explains why the chat did not open and can open it anyway", async () => {
    vi.mocked(openLiveChat).mockResolvedValueOnce(false);
    render(<ChatWithUs />);
    fireEvent.click(screen.getByRole("button", { name: /Scrie-ne acum/ }));
    expect(await screen.findByText(/Ești pe dispozitivul de admin/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deschide oricum" }));
    expect(openLiveChat).toHaveBeenLastCalledWith({ force: true });
  });

  test("the fake WhatsApp field sends the typed text to the real WhatsApp", () => {
    render(<ChatWithUs />);
    const send = screen.getByRole("link", { name: "Trimite pe WhatsApp" });
    const click = vi.fn((event: Event) => event.preventDefault());
    send.addEventListener("click", click);

    fireEvent.change(screen.getByRole("textbox", { name: "Mesaj pe WhatsApp" }), { target: { value: "Aveți liber pe 12 iunie?" } });
    expect(send.getAttribute("href")).toBe(`https://wa.me/40745469907?text=${encodeURIComponent("Aveți liber pe 12 iunie?")}`);

    // Enter submits the field, which clicks the same wa.me link (so it is tracked like any WhatsApp click).
    fireEvent.submit(screen.getByRole("textbox", { name: "Mesaj pe WhatsApp" }).closest("form")!);
    expect(click).toHaveBeenCalledTimes(1);
  });

  test("with nothing typed it still opens WhatsApp with a greeting", () => {
    render(<ChatWithUs />);
    expect(screen.getByRole("link", { name: "Trimite pe WhatsApp" }).getAttribute("href")).toContain(encodeURIComponent("Bună! Am o întrebare."));
  });

  test("the emoji button adds emojis to the WhatsApp message", () => {
    render(<ChatWithUs />);
    const field = screen.getByRole("textbox", { name: "Mesaj pe WhatsApp" });
    fireEvent.change(field, { target: { value: "Mulțumim" } });
    fireEvent.click(screen.getByRole("button", { name: "Emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Adaugă 🙏" }));
    expect(field).toHaveValue("Mulțumim🙏");
    expect(screen.getByRole("link", { name: "Trimite pe WhatsApp" }).getAttribute("href")).toContain(encodeURIComponent("Mulțumim🙏"));
  });

  test("adds the offer built in the configurator to the WhatsApp message on request", async () => {
    localStorage.setItem("configurator-offer", JSON.stringify({
      text: "Oferta configurată pe site: nuntă\n• Foto + Video — 1.100 €", event: "Nuntă", picks: ["Foto + Video"], savedAt: Date.now(),
    }));
    render(<ChatWithUs />);
    expect(await screen.findByText(/Am văzut că vă interesează foto \+ video/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Mesaj pe WhatsApp" }), { target: { value: "Ce include albumul?" } });
    fireEvent.click(screen.getByRole("button", { name: /Adaugă în mesaj oferta configurată/ }));
    const href = decodeURIComponent(screen.getByRole("link", { name: "Trimite pe WhatsApp" }).getAttribute("href")!);
    expect(href).toContain("Ce include albumul?\n\nOferta configurată pe site: nuntă\n• Foto + Video — 1.100 €");

    fireEvent.click(screen.getByRole("button", { name: "Scoate oferta din mesaj" }));
    expect(decodeURIComponent(screen.getByRole("link", { name: "Trimite pe WhatsApp" }).getAttribute("href")!)).not.toContain("Oferta configurată");
    localStorage.clear();
  });

  test("without a configured offer there is no add-offer button", () => {
    render(<ChatWithUs />);
    expect(screen.queryByRole("button", { name: /Adaugă în mesaj oferta configurată/ })).not.toBeInTheDocument();
  });

  test("after the greeting comes the free QR Code Moments message (all at once without animation)", () => {
    render(<ChatWithUs />);
    expect(screen.getByText(/Haideți să vedem dacă vă putem ajuta/)).toBeInTheDocument();
    expect(screen.getByText(/QR Code Moments/)).toBeInTheDocument();
    expect(screen.getByText("gratuit").tagName).toBe("STRONG");
    expect(screen.queryByLabelText("scrie…")).not.toBeInTheDocument();
  });
});
