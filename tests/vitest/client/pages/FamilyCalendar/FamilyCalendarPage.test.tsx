/*
 * Purpose: /zile-ocupate — Estera signs in with her email + a one-time code (or the email's button),
 * then sees the events as a list (date + price) or a month calendar, and asks for family time.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import FamilyCalendarPage from "src/client/pages/FamilyCalendar/FamilyCalendarPage";

const events = [
  { id: "old", dates: ["2026-10-10"], type: "Botez", clientName: "Maria", location: "", total: 800, status: "finalizat" },
  { id: "w1", dates: ["2026-10-31"], type: "Nuntă", clientName: "Ana & Ion", location: "Castelul X", total: 2500, status: "confirmat" },
  { id: "w2", dates: ["2027-06-12", "2027-06-13"], type: "Nuntă", clientName: "Elena", location: "", total: null, status: "confirmat" },
];
const familyTime = [{ id: "f1", startDate: "2026-11-02", endDate: "2026-11-03", note: "Munte", status: "approved", createdAt: "2026-10-20T10:00:00Z", decidedAt: null, reply: "" }];
const data = { viewer: "family", events, familyTime, icsUrl: "https://ancavisuals.ro/api/family-calendar/tok/calendar.ics", generatedAt: "" };
const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));
  localStorage.clear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const renderPage = (url = "/zile-ocupate") => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="/zile-ocupate" element={<FamilyCalendarPage />} /></Routes></MemoryRouter>,
);

test("not signed in: email → code (pasted from the clipboard) → calendar", async () => {
  let signedIn = false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/family-calendar/events") return signedIn ? ok(data) : ok({ error: "Intră" }, 401);
    if (url === "/api/family-calendar/login/request") return ok({ ok: true });
    if (url === "/api/family-calendar/login/verify") {
      signedIn = JSON.parse(String(init?.body)).code === "123456";
      return signedIn ? ok({ ok: true }) : ok({ error: "Codul nu e corect." }, 401);
    }
    throw new Error(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", { value: { readText: async () => "Codul tău: 123456" }, configurable: true });

  renderPage();
  fireEvent.change(await screen.findByLabelText("Emailul sau telefonul tău"), { target: { value: "estera.pop97@gmail.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Trimite-mi codul" }));
  expect(await screen.findByText(/Ți-am trimis un cod de 6 cifre pe estera\.pop97@gmail\.com/)).toBeInTheDocument();
  expect(screen.getByLabelText("Codul primit")).toHaveAttribute("autocomplete", "one-time-code");

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "📋 Lipește" })); });
  expect(await screen.findByRole("heading", { name: "Octombrie 2026" })).toBeInTheDocument();
  expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => url === "/api/family-calendar/login/verify")![1]!.body))).toEqual({ email: "estera.pop97@gmail.com", code: "123456" });
  expect(localStorage.getItem("familyCalendar:email")).toBe("estera.pop97@gmail.com");
});

test("the email's button (?intra=) signs in directly", async () => {
  const fetchMock = vi.fn(async (url: string) => (url === "/api/family-calendar/login/verify" ? ok({ ok: true }) : ok(data)));
  vi.stubGlobal("fetch", fetchMock);
  renderPage("/zile-ocupate?intra=magic123");
  expect(await screen.findByRole("heading", { name: "Octombrie 2026" })).toBeInTheDocument();
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ magic: "magic123" });
});

test("list: each coming event with its date and price, past ones on request", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ok(data)));
  renderPage();
  fireEvent.click(await screen.findByRole("tab", { name: "📋 Listă" }));
  const list = screen.getByRole("region", { name: "Listă" });
  expect(within(list).getByText("Nuntă · Ana & Ion")).toBeInTheDocument();
  expect(within(list).getByText(/2\.?500\s(€|EUR)/, { selector: "li p" })).toBeInTheDocument();
  expect(within(list).getByText(/12 iunie – .*13 iunie/)).toBeInTheDocument();
  expect(within(list).queryByText("Botez · Maria")).not.toBeInTheDocument();
  fireEvent.click(within(list).getByLabelText("Arată și evenimentele trecute"));
  expect(within(list).getByText("Botez · Maria")).toBeInTheDocument();
  expect(localStorage.getItem("familyCalendar:view")).toBe("list");
});

test("calendar shows approved family days; a free day can be asked for, with a warning on clashes", async () => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/family-calendar/family-time") return ok({ request: { ...familyTime[0], id: "f2", status: "pending", ...JSON.parse(String(init?.body)) } }, 201);
    return ok(data);
  });
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Luna următoare" }));
  expect(screen.getByRole("button", { name: /2 noiembrie 2026: timp pentru familie/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Luna anterioară" }));
  fireEvent.click(screen.getByRole("button", { name: /^vineri, 30 octombrie 2026$/ }));
  fireEvent.click(screen.getByRole("button", { name: "🏡 Cere ziua asta pentru familie" }));
  const section = screen.getByRole("region", { name: "Timp pentru familie" });
  fireEvent.change(within(section).getByLabelText(/Ultima zi/), { target: { value: "2026-11-01" } });
  expect(within(section).getByText(/În perioada asta ai deja: Nuntă · Ana & Ion/)).toBeInTheDocument();
  fireEvent.change(within(section).getByLabelText(/Pentru ce/), { target: { value: "Ziua mamei" } });
  fireEvent.click(within(section).getByRole("button", { name: /^Cere perioada:/ }));

  await waitFor(() => expect(within(section).getByText(/a fost trimisă/)).toBeInTheDocument());
  const sent = fetchMock.mock.calls.find(([url]) => url === "/api/family-calendar/family-time")!;
  expect(JSON.parse(String(sent[1]!.body))).toEqual({ startDate: "2026-10-30", endDate: "2026-11-01", note: "Ziua mamei" });
  expect(within(section).getByText("✓ Aprobat")).toBeInTheDocument();
});

test("Salomeea (helper) sees her events without prices and can't ask for family time", async () => {
  const helperData = { viewer: "helper", events: [{ ...events[1], total: null }], familyTime: [], icsUrl: data.icsUrl, generatedAt: "" };
  vi.stubGlobal("fetch", vi.fn(async () => ok(helperData)));
  renderPage();
  expect(await screen.findByText("Evenimentele la care lucrezi cu noi.")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Timp pentru familie" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "📋 Listă" }));
  const list = screen.getByRole("region", { name: "Listă" });
  expect(within(list).getByText("Nuntă · Ana & Ion")).toBeInTheDocument();
  expect(within(list).queryByText("—")).not.toBeInTheDocument();
  expect(within(list).queryByText(/€|EUR/)).not.toBeInTheDocument();
});

test("a phone number gets the code by SMS", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/family-calendar/login/request" ? ok({ ok: true, channel: "sms" }) : ok({ error: "Intră" }, 401))));
  renderPage();
  fireEvent.change(await screen.findByLabelText("Emailul sau telefonul tău"), { target: { value: "0722 123 456" } });
  fireEvent.click(screen.getByRole("button", { name: "Trimite-mi codul" }));
  expect(await screen.findByText("Ți-am trimis prin SMS un cod de 6 cifre la 0722 123 456. E valabil 10 minute.")).toBeInTheDocument();
});
