import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailFailureBanner from "src/client/features/admin/components/EmailFailureBanner";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  render(<EmailFailureBanner accessToken="token" />);
  expect(await screen.findByText("⚠ NU PUTEM VERIFICA STAREA EMAILURILOR")).toBeTruthy();
});
