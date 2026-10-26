import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import WeddingGuideLeadMagnet, { WEDDING_GUIDE_URL } from "src/client/pages/CampaignLanding/WeddingGuideLeadMagnet";
import { sendLiveEvent } from "src/client/utils/liveEvent";

vi.mock("src/client/utils/liveEvent", () => ({ sendLiveEvent: vi.fn() }));
vi.mock("src/client/utils/oaiq", () => ({ measureOaiq: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("the PDF opens directly, without asking for an email or a phone", () => {
  render(<WeddingGuideLeadMagnet book={null} pagePath="/oferta/olx" />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  const link = screen.getByRole("link", { name: /Deschide Ghidul Mirilor/ });
  expect(link.getAttribute("href")).toBe(WEDDING_GUIDE_URL);
  fireEvent.click(link);
  expect(sendLiveEvent).toHaveBeenCalledWith("guide_downloaded", expect.objectContaining({ label: "Ghidul Mirilor" }));
});
