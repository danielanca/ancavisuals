import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import WeddingGuideLeadMagnet, { WEDDING_GUIDE_URL, parseGuideContact } from "src/client/pages/CampaignLanding/WeddingGuideLeadMagnet";
import { sendLiveEvent } from "src/client/utils/liveEvent";

vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));
vi.mock("src/client/utils/oaiq", () => ({ measureOaiq: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const renderGuide = () => render(<WeddingGuideLeadMagnet book={null} pagePath="/oferta/olx" />);

test("recognizes an email or a phone number", () => {
  expect(parseGuideContact(" Ana@Mail.ro ")).toEqual({ email: "ana@mail.ro" });
  expect(parseGuideContact("0712 345 678")).toEqual({ phone: "0712 345 678" });
  expect(parseGuideContact("+40 712-345-678")).toEqual({ phone: "+40 712-345-678" });
  expect(parseGuideContact("ana")).toBeNull();
  expect(parseGuideContact("12345")).toBeNull();
});

test("the PDF unlocks only after the email is saved as a lead", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  vi.stubGlobal("fetch", fetchMock);
  renderGuide();
  expect(screen.queryByRole("link", { name: /Deschide Ghidul Mirilor/ })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Unde vă trimitem ghidul?"), { target: { value: "ana@mail.ro" } });
  fireEvent.click(screen.getByRole("button", { name: "Primește ghidul" }));

  expect((await screen.findByRole("link", { name: /Deschide Ghidul Mirilor/ })).getAttribute("href")).toBe(WEDDING_GUIDE_URL);
  expect(fetchMock).toHaveBeenCalledWith("/api/campaign/guide-lead", expect.objectContaining({
    method: "POST", body: JSON.stringify({ email: "ana@mail.ro", page: "/oferta/olx" }),
  }));
  expect(sendLiveEvent).toHaveBeenCalledWith("guide_downloaded", expect.objectContaining({ label: "Ghidul Mirilor" }));
});

test("an invalid contact is refused without a request", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  renderGuide();
  fireEvent.change(screen.getByLabelText("Unde vă trimitem ghidul?"), { target: { value: "ana" } });
  fireEvent.click(screen.getByRole("button", { name: "Primește ghidul" }));
  expect(screen.getByRole("alert")).toHaveTextContent("email sau un număr de telefon");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("asking on WhatsApp unlocks it too, and isn't counted as an Ads offer request", () => {
  renderGuide();
  const whatsapp = screen.getByRole("link", { name: /cereți-l pe WhatsApp/ });
  expect(whatsapp.getAttribute("href")).toContain("wa.me/40745469907");
  expect(whatsapp.getAttribute("data-ads-contact")).toBe("off");
  fireEvent.click(whatsapp);
  expect(screen.getByRole("link", { name: /Deschide Ghidul Mirilor/ })).toBeInTheDocument();
});
