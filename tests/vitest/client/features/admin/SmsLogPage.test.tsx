/*
 * Purpose: /admin/sms-log lists the SMS the site sent — time, number, event, feature, exact text —
 * and finds them by phone (typed with a leading 0) or by client name.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import SmsLogPage from "src/client/features/admin/components/SmsLogPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
afterEach(() => vi.unstubAllGlobals());

test("shows each SMS and searches by phone or name", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sms: [
      { id: "1", to: "+40745123456", text: "Pozele sunt gata", status: "sent", source: "album-update", event: "25iulie2026", recipientName: "Ana", error: null, createdAt: "2026-10-27T10:15:00.000Z" },
      { id: "2", to: "+40722000111", text: "Semnati PV", status: "failed", source: "handover-sms", event: "nunta 2026-08-08", recipientName: "Ion", error: "SMSAPI 103", createdAt: "2026-10-26T09:00:00.000Z" },
    ] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><SmsLogPage /></MemoryRouter>);
  expect(await screen.findByText("Pozele sunt gata")).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/sms-log");
  expect(screen.getByText(/Noutăți album/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "25iulie2026 ↗" })).toHaveAttribute("href", "/media/25iulie2026");
  expect(screen.getByText(/nunta 2026-08-08/)).toBeInTheDocument();
  expect(screen.getByText("✕ Eșuat")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Caută în SMS-uri"), { target: { value: "0722 000" } });
  expect(screen.queryByText("Pozele sunt gata")).not.toBeInTheDocument();
  expect(screen.getByText("Semnati PV")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Caută în SMS-uri"), { target: { value: "ana" } });
  expect(screen.getByText("Pozele sunt gata")).toBeInTheDocument();
  expect(screen.queryByText("Semnati PV")).not.toBeInTheDocument();
});
