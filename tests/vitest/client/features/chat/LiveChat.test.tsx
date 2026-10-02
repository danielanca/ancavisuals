/*
 * Purpose: the Tidio live chat script is injected once on public pages, its own
 * launcher stays hidden, and our "Conversați cu noi" block opens it on demand.
 */
import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import LiveChat, { LIVE_CHAT_COLOR, openLiveChat, subscribeToLiveChatStatus, TIDIO_PUBLIC_KEY } from "src/client/features/chat/components/LiveChat";

afterEach(() => {
  document.getElementById("tidio-script")?.remove();
  delete window.tidioChatApi;
});

describe("LiveChat (Tidio)", () => {
  test("does not load on a private page", () => {
    render(<LiveChat visible={false} />);
    expect(document.getElementById("tidio-script")).toBeNull();
  });

  test("keeps Tidio's own launcher tab hidden — <ChatWithUs /> replaces it", () => {
    const api = { show: vi.fn(), hide: vi.fn() };
    window.tidioChatApi = api;
    const { rerender } = render(<LiveChat visible />);
    expect(api.hide).toHaveBeenCalled();
    rerender(<LiveChat visible={false} />);
    expect(api.show).not.toHaveBeenCalled();
  });

  test("openLiveChat shows and opens the chat, and hides the launcher again on close", () => {
    const handlers: Record<string, () => void> = {};
    const api = { show: vi.fn(), hide: vi.fn(), open: vi.fn(), on: vi.fn((e: string, cb: () => void) => { handlers[e] = cb; }) };
    window.tidioChatApi = api;
    openLiveChat();
    expect(api.show).toHaveBeenCalled();
    expect(api.open).toHaveBeenCalled();
    handlers.close();
    expect(api.hide).toHaveBeenCalled();
  });

  test("uses the site's colour", () => {
    const api = { show: vi.fn(), hide: vi.fn(), setColorPalette: vi.fn() };
    window.tidioChatApi = api;
    render(<LiveChat visible />);
    expect(api.setColorPalette).toHaveBeenCalledWith(LIVE_CHAT_COLOR);
  });

  test("applies visibility once Tidio reports ready", () => {
    render(<LiveChat visible={false} />);
    const api = { show: vi.fn(), hide: vi.fn() };
    window.tidioChatApi = api;
    document.dispatchEvent(new Event("tidioChat-ready"));
    expect(api.hide).toHaveBeenCalled();
  });

  test("reports Tidio's operator status and follows its setStatus event", () => {
    const handlers: Record<string, () => void> = {};
    let current: "online" | "offline" = "online";
    window.tidioChatApi = {
      show: vi.fn(), hide: vi.fn(),
      getStatus: () => current,
      on: vi.fn((e: string, cb: () => void) => { handlers[e] = cb; }),
    };
    const callback = vi.fn();
    const unsubscribe = subscribeToLiveChatStatus(callback);
    expect(callback).toHaveBeenLastCalledWith("online");

    current = "offline";
    handlers.setStatus();
    expect(callback).toHaveBeenLastCalledWith("offline");

    unsubscribe();
    current = "online";
    handlers.setStatus();
    expect(callback).toHaveBeenLastCalledWith("offline");
  });

  // Last: openLiveChat() marks the chat as requested for the rest of the module.
  test("does not load Tidio with the page — only when the visitor asks to talk", () => {
    render(<LiveChat visible />);
    expect(document.getElementById("tidio-script")).toBeNull();

    void openLiveChat();
    void openLiveChat();
    const scripts = document.querySelectorAll("#tidio-script");
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(`https://code.tidio.co/${TIDIO_PUBLIC_KEY}.js`);
  });
});
