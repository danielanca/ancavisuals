/*
 * Purpose: /admin/calendar-familie — approve Estera's family-time requests and send her the invite;
 * pick the events Salomeea works at.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import FamilyCalendarAdminPage from "src/client/features/admin/components/FamilyCalendarAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
afterEach(() => vi.unstubAllGlobals());

const state = { pageUrl: "https://ancavisuals.ro/zile-ocupate", icsUrl: "https://ancavisuals.ro/api/family-calendar/tok/calendar.ics", recipientEmail: "estera.pop97@gmail.com", weeklyEmail: false, lastEmailAt: null,
  helperEmail: "salomeeamitre602@gmail.com", helperEventIds: [] as string[], helperIcsUrl: "https://ancavisuals.ro/api/family-calendar/htok/calendar.ics",
  recipientPhone: "", helperPhone: "+40722123456", reminders: true, smsConfigured: true,
  calendarEvents: [
    { id: "w1", dates: ["2099-11-14"], type: "Nuntă", clientName: "Ana & Ion", location: "Castelul X", total: 2500, status: "confirmat" },
    { id: "old", dates: ["2020-09-01"], type: "Botez", clientName: "Maria", location: "", total: 800, status: "finalizat" },
  ] };
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

test("ticking an event assigns it to Salomeea; past events only on request", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/family-calendar" && !init?.method) return ok(state);
    if (url === "/api/admin/family-calendar" && init?.method === "PATCH") return ok({ ...state, ...JSON.parse(String(init.body)), notified: { email: true, sms: true, events: 1 } });
    if (url === "/api/admin/family-time") return ok({ requests: [] });
    throw new Error(url);
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<MemoryRouter><FamilyCalendarAdminPage /></MemoryRouter>);
  const section = await screen.findByRole("region", { name: "Salomeea" });
  expect(within(section).queryByText(/Botez · Maria/)).not.toBeInTheDocument();
  fireEvent.click(within(section).getByLabelText("Salomeea la Nuntă · Ana & Ion"));
  expect(await screen.findByText("Salomeea vede acum: Nuntă · Ana & Ion. I-am trimis email și SMS.")).toBeInTheDocument();
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(JSON.parse(String(patch[1]!.body))).toEqual({ helperEventIds: ["w1"] });
  expect(within(section).getByLabelText("Salomeea la Nuntă · Ana & Ion")).toBeChecked();
  fireEvent.click(within(section).getByLabelText("Arată și trecute"));
  expect(within(section).getByText(/Botez · Maria/)).toBeInTheDocument();
});

test("sends a message to both by email and SMS", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/family-calendar" && !init?.method) return ok(state);
    if (url === "/api/admin/family-time") return ok({ requests: [] });
    if (url === "/api/admin/family-calendar/message") return ok({ results: [{ name: "Estera", email: true, sms: false }, { name: "Salomeea", email: true, sms: true }] });
    throw new Error(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><FamilyCalendarAdminPage /></MemoryRouter>);
  const section = await screen.findByRole("region", { name: "Trimite un mesaj" });
  fireEvent.click(within(section).getByLabelText("SMS"));
  expect(within(section).getByText(/Cine nu are telefon salvat/)).toBeInTheDocument();
  fireEvent.change(within(section).getByLabelText("Mesajul"), { target: { value: "Plecăm la 9." } });
  fireEvent.click(within(section).getByRole("button", { name: "Trimite" }));
  expect(await screen.findByText("Mesaj trimis. Estera: email, Salomeea: email + SMS.")).toBeInTheDocument();
  expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/admin/family-calendar/message")![1]!.body)))
    .toEqual({ to: ["family", "helper"], text: "Plecăm la 9.", email: true, sms: true });
});
