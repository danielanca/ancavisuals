/*
 * Purpose: verifies that the visitor notification hook fires exactly once per
 * unique URL per session, skips admin/system routes, and respects the admin
 * cookie — ensuring the admin does not receive duplicate or unwanted emails.
 */
import React from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useVisitorNotification } from "src/client/hooks/useVisitorNotification";

vi.mock("src/client/utils/triggers", () => ({
  sendTriggerEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("src/client/utils/functions", () => ({
  isBrowser: vi.fn().mockReturnValue(true),
  getCookie: vi.fn().mockReturnValue(null),
  setCookie: vi.fn(),
}));

import { sendTriggerEmail } from "src/client/utils/triggers";
import { getCookie, isBrowser } from "src/client/utils/functions";

function wrapper(initialPath: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(sendTriggerEmail).mockClear();
  vi.mocked(isBrowser).mockReturnValue(true);
  vi.mocked(getCookie).mockReturnValue(null);
});

describe("useVisitorNotification", () => {
  test("sends email on first visit to a public page", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/portofoliu") });

    expect(sendTriggerEmail).toHaveBeenCalledOnce();
    expect(sendTriggerEmail).toHaveBeenCalledWith({ typeEvent: "Vizitator", url: "/portofoliu", isNewVisitor: true });
  });

  test("does not send the generic visitor email for the offer route", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/oferta/olx") });

    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("does not send email for the same URL a second time in the same session", () => {
    const wrap = wrapper("/portofoliu");
    renderHook(() => useVisitorNotification(), { wrapper: wrap });
    renderHook(() => useVisitorNotification(), { wrapper: wrap });

    expect(sendTriggerEmail).toHaveBeenCalledOnce();
  });

  test("sends separate emails for two distinct URLs", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/portofoliu") });
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/contact") });

    expect(sendTriggerEmail).toHaveBeenCalledTimes(2);
  });

  test("skips /admin prefix", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/admin/events") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("skips /login", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/login") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("skips /revin", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/revin") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("skips /wedding-hub prefix", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/wedding-hub/dashboard") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("skips /colaborator prefix", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/colaborator/abc") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("does nothing when admin cookie is set", () => {
    vi.mocked(getCookie).mockReturnValue("1");
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/portofoliu") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("does nothing when not in browser environment", () => {
    vi.mocked(isBrowser).mockReturnValue(false);
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/portofoliu") });
    expect(sendTriggerEmail).not.toHaveBeenCalled();
  });

  test("persists visited URLs across hook instances via sessionStorage", () => {
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/nunta-cluj") });
    // simulate a second component mount on the same route (e.g., re-render after navigation)
    renderHook(() => useVisitorNotification(), { wrapper: wrapper("/nunta-cluj") });

    expect(sendTriggerEmail).toHaveBeenCalledOnce();
    const stored = JSON.parse(sessionStorage.getItem("av_notified") ?? "[]") as string[];
    expect(stored).toContain("/nunta-cluj");
  });
});
