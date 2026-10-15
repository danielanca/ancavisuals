import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailFailureBanner from "src/client/features/admin/components/EmailFailureBanner";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const incident = { id: "incident", occurredAt: "2026-09-27T00:00:00Z", error: "Autentificare refuzată", subject: "Invitație", to: "admin@example.com", diagnostic: "code: EAUTH\nresponseCode: 535\nError: Invalid login\n at sendMail" };

test("shows a large alert, copies diagnostics, and explicitly acknowledges it", async () => {
  let active = true;
  const fetchMock = vi.fn(async (_url, options) => {
    if (options?.method === "POST") active = false;
    return { ok: true, json: async () => ({ alert: active ? incident : null }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<EmailFailureBanner accessToken="token" />);
  expect(await screen.findByText("⚠ ALERTĂ EMAIL — O TRIMITERE A EȘUAT")).toBeTruthy();
  fireEvent.click(screen.getByText("Copiază eroarea"));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("responseCode: 535"));
  fireEvent.click(screen.getByText("Am văzut alerta — ascunde"));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/email-alert/acknowledge", expect.objectContaining({ body: JSON.stringify({ id: "incident" }) }));
});

test("does not silently report healthy when monitoring fails", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  render(<EmailFailureBanner accessToken="token" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
  expect(screen.queryByRole("alert")).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByText("⚠ NU PUTEM VERIFICA STAREA EMAILURILOR")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("recovers silently after two temporary failures and ignores overlapping focus checks", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValue({ ok: true, json: async () => ({ alert: null }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<EmailFailureBanner accessToken="token" />);
  fireEvent.focus(window);
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("cancels retries when unmounted", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  const { unmount } = render(<EmailFailureBanner accessToken="token" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("asks for a fresh token on every check so an expired session token does not raise the banner", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async (_url, options) => options?.headers?.Authorization === "Bearer fresh"
    ? { ok: true, json: async () => ({ alert: null }) }
    : { ok: false, status: 401 });
  vi.stubGlobal("fetch", fetchMock);
  const getToken = vi.fn().mockResolvedValue("fresh");
  render(<EmailFailureBanner accessToken="expired" getToken={getToken} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
});
