/*
 * Purpose: the Tidio live chat script is injected once and the widget is hidden
 * on private pages (admin, client albums…).
 */
import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import LiveChat, { LIVE_CHAT_COLOR, TIDIO_PUBLIC_KEY } from "src/client/features/chat/components/LiveChat";

afterEach(() => {
  document.getElementById("tidio-script")?.remove();
  delete window.tidioChatApi;
});

describe("LiveChat (Tidio)", () => {
  test("injects the Tidio script once on a public page", () => {
    const { rerender } = render(<LiveChat visible />);
    rerender(<LiveChat visible />);
    const scripts = document.querySelectorAll("#tidio-script");
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(`https://code.tidio.co/${TIDIO_PUBLIC_KEY}.js`);
  });

  test("does not load on a private page", () => {
    render(<LiveChat visible={false} />);
    expect(document.getElementById("tidio-script")).toBeNull();
  });

  test("hides / shows the widget when the page changes", () => {
    const api = { show: vi.fn(), hide: vi.fn() };
    window.tidioChatApi = api;
    const { rerender } = render(<LiveChat visible />);
    expect(api.show).toHaveBeenCalled();
    rerender(<LiveChat visible={false} />);
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
});
