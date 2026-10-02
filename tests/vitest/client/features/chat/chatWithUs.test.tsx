/*
 * Purpose: the end-of-page "Conversați cu noi" block opens the Tidio chat (whose own
 * launcher is hidden) and logs the intent in the live panel.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

let status: "online" | "offline" = "online";
vi.mock("src/client/features/chat/components/LiveChat", () => ({
  openLiveChat: vi.fn(() => Promise.resolve()),
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
    expect(screen.getByRole("heading", { name: /Conversați cu/ })).toBeInTheDocument();
    expect(screen.getByText("Suntem online")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scrie-ne acum/ }));
    expect(openLiveChat).toHaveBeenCalledTimes(1);
    expect(sendLiveEvent).toHaveBeenCalledWith("chat_opened", expect.anything());

    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("wa.me/40745469907");
  });

  test("shows offline when nobody is available in the Tidio app", () => {
    status = "offline";
    render(<ChatWithUs />);
    expect(screen.getByText("Suntem offline")).toBeInTheDocument();
    expect(screen.getByText(/vă răspundem imediat ce revenim online/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scrie-ne acum/ })).toBeInTheDocument();
  });
});
