/*
 * Purpose: verifies that useClientErrorReporting attaches error listeners,
 * forwards events to the monitoring endpoint, skips reporting for admins,
 * and removes listeners on unmount.
 */
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { getCookieMock } = vi.hoisted(() => ({ getCookieMock: vi.fn() }));

vi.mock("src/client/utils/functions", () => ({
  getCookie: getCookieMock,
}));

import { useClientErrorReporting } from "src/client/hooks/useClientErrorReporting";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getCookieMock.mockReturnValue(null);
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

describe("useClientErrorReporting", () => {
  test("reports window error events to monitoring endpoint", async () => {
    renderHook(() => useClientErrorReporting());

    await act(async () => {
      const err = new Error("Something broke");
      window.dispatchEvent(
        new ErrorEvent("error", { message: "Something broke", error: err }),
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoring/client-error",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toBe("Something broke");
    expect(body.page).toBe(window.location.pathname);
  });

  test("does not report errors when admin cookie is set", async () => {
    getCookieMock.mockReturnValue("1");
    renderHook(() => useClientErrorReporting());

    await act(async () => {
      window.dispatchEvent(new ErrorEvent("error", { message: "Admin error" }));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("removes event listeners on unmount", async () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useClientErrorReporting());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  test("reports unhandled promise rejections", async () => {
    renderHook(() => useClientErrorReporting());

    await act(async () => {
      const reason = new Error("Async failure");
      const event = Object.assign(new Event("unhandledrejection"), { reason });
      window.dispatchEvent(event);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toContain("Unhandled Promise Rejection");
    expect(body.message).toContain("Async failure");
  });

  test("handles non-Error promise rejections gracefully", async () => {
    renderHook(() => useClientErrorReporting());

    await act(async () => {
      const event = Object.assign(new Event("unhandledrejection"), { reason: "plain string error" });
      window.dispatchEvent(event);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toContain("plain string error");
    expect(body.stack).toBe("");
  });
});
