import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import ActivityInbox from "src/client/features/admin/components/ActivityInbox";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/EmailDiagnostics", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("shows the date and Romanian time for both Firestore timestamp shapes on every entry", async () => {
  const seconds = Date.parse("2026-10-07T12:34:56Z") / 1000;
  const activity = { type: "contact", description: "", metadata: {}, read: true, emailSent: false };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url === "/api/admin/activity" ? { activities: [
      { ...activity, id: "1", title: "Telefon", createdAt: { _seconds: seconds } },
      { ...activity, id: "2", title: "Contact", createdAt: { seconds } },
    ] } : null,
  })));
  render(<MemoryRouter><ActivityInbox /></MemoryRouter>);
  const timestamps = await screen.findAllByText(/07\.10\.2026.*15:34:56/);
  expect(timestamps).toHaveLength(2);
});
