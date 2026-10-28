/*
 * Purpose: /admin/calendar-familie — approve Estera's family-time requests and send her the invite.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import FamilyCalendarAdminPage from "src/client/features/admin/components/FamilyCalendarAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
afterEach(() => vi.unstubAllGlobals());

const state = { pageUrl: "https://ancavisuals.ro/zile-ocupate", icsUrl: "https://ancavisuals.ro/api/family-calendar/tok/calendar.ics", recipientEmail: "estera.pop97@gmail.com", weeklyEmail: false, lastEmailAt: null };
const pending = { id: "r1", startDate: "2026-12-27", endDate: "2026-12-30", note: "Munte", status: "pending", createdAt: "2026-10-28T10:00:00Z", decidedAt: null, reply: "" };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

test("approves a request with a message and sends the invite", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/family-calendar" && !init?.method) return ok(state);
    if (url === "/api/admin/family-time") return ok({ requests: [pending] });
    if (url === "/api/admin/family-time/r1/decision") return ok({ request: { ...pending, ...JSON.parse(String(init?.body)) } });
    if (url === "/api/admin/family-calendar/send-email") return ok({ ...state, to: state.recipientEmail, events: 12 });
    throw new Error(url);
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><FamilyCalendarAdminPage /></MemoryRouter>);
  const card = await screen.findByRole("listitem", { name: /27 decembrie 2026 – .*30 decembrie 2026/ });
  expect(within(card).getByText("4 zile", { exact: false })).toBeInTheDocument();
  expect(within(card).getByText("„Munte”")).toBeInTheDocument();
  fireEvent.change(within(card).getByLabelText("Mesaj pentru Estera (opțional)"), { target: { value: "Sigur!" } });
  fireEvent.click(within(card).getByRole("button", { name: "✓ Aprobă" }));
  expect(await screen.findByText(/Aprobat\. Zilele apar ocupate pe site/)).toBeInTheDocument();
  expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/admin/family-time/r1/decision")![1]!.body))).toEqual({ status: "approved", reply: "Sigur!" });
  expect(screen.getByText("✓ Aprobat")).toBeInTheDocument();

  expect(screen.getByText(state.pageUrl)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Trimite emailul" }));
  expect(await screen.findByText("Email trimis la estera.pop97@gmail.com, cu 12 evenimente în calendar.")).toBeInTheDocument();
});
