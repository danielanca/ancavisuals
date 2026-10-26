import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import HandoverListPage from "src/client/features/admin/components/Handover/HandoverListPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/Handover/HandoverActionMenu", () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const event = { id: "event-1", type: "Nuntă", eventDate: "2026-07-25", client: { fullName: "Ana și Ion" } };
const protocol = { id: "pv-1", token: "token", status: "signed", eventType: "Nuntă", eventDate: "2026-07-25", clientEmail: "", createdAt: "2026-10-07" };
function Location() {
  const location = useLocation();
  return <output>{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}
function mockData(items: unknown[], events: unknown[], ok = true) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: init?.method === "POST" ? ok : true,
    json: async () => init?.method === "POST" ? { ok, error: ok ? undefined : "Asocierea a eșuat" }
      : url === "/api/handover" ? { items } : { events },
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><HandoverListPage /><Location /></MemoryRouter>);
  return fetchMock;
}

test("shows the linked event and signed state, and opens that event", async () => {
  mockData([{ ...protocol, eventId: event.id }], [event]);
  fireEvent.click(await screen.findByRole("button", { name: /Eveniment: Ana și Ion/ }));
  expect(screen.getByText("Clientul a semnat preluarea responsabilității")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent('"scrollToEvent":"event-1"');
});
test("recognizes the reverse event association and keeps unsigned status clear", async () => {
  mockData([{ ...protocol, status: "sent" }], [{ ...event, handoverId: protocol.id }]);
  expect(await screen.findByRole("button", { name: /Eveniment: Ana și Ion/ })).toBeInTheDocument();
  expect(screen.getByText("Așteaptă semnarea de către client")).toBeInTheDocument();
});
test("associates an existing signed protocol from the list", async () => {
  const fetchMock = mockData([protocol], [event]);
  const select = await screen.findByRole("combobox");
  await screen.findByRole("option", { name: /Ana și Ion/ });
  fireEvent.change(select, { target: { value: event.id } });
  fireEvent.click(screen.getByRole("button", { name: "Asociază eveniment" }));
  expect(await screen.findByRole("button", { name: /Eveniment: Ana și Ion/ })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith("/api/handover/pv-1/event", expect.objectContaining({
    method: "POST", body: JSON.stringify({ eventId: event.id }),
  }));
});
test("does not show an association when saving fails", async () => {
  mockData([protocol], [event], false);
  const select = await screen.findByRole("combobox");
  await screen.findByRole("option", { name: /Ana și Ion/ });
  fireEvent.change(select, { target: { value: event.id } });
  fireEvent.click(screen.getByRole("button", { name: "Asociază eveniment" }));
  await waitFor(() => expect(screen.getByText("Asocierea a eșuat")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /Eveniment: Ana și Ion/ })).not.toBeInTheDocument();
});
test("signed protocols show the download deadline but no reminder button", async () => {
  const signedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  mockData([{ ...protocol, eventId: event.id, signedAt, digitalLinkExpiryDays: 15 }],
    [{ ...event, client: { ...event.client, phone: "0712345678" } }]);
  expect(await screen.findByText(/Link-uri valabile până:/)).toHaveTextContent("10 zile rămase");
  expect(screen.queryByRole("button", { name: /reminder/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Reminder/ })).not.toBeInTheDocument();
});
test("an unsigned protocol can be reminded by email + SMS, again and again", async () => {
  const pending = { ...protocol, status: "sent", eventId: event.id, clientEmail: "ana@example.com", sentAt: new Date().toISOString() };
  let posts = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => init?.method === "POST"
      ? { ok: true, emailed: true, smsSent: true, signReminderSentAt: new Date().toISOString(), signReminderCount: ++posts }
      : url === "/api/handover" ? { items: [pending] } : { events: [{ ...event, client: { ...event.client, phone: "0712345678" } }] },
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><HandoverListPage /></MemoryRouter>);
  expect(await screen.findByText(/Automat la 3 zile \(max 4\)/)).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "⏰ Trimite reminder (email + SMS)" }));
  fireEvent.click(await screen.findByRole("button", { name: "🔁 Trimite din nou reminder (email + SMS)" }));
  await waitFor(() => expect(screen.getByText(/Ultimul reminder:/)).toHaveTextContent("2×"));
  expect(fetchMock.mock.calls.filter(([url]) => url === "/api/handover/pv-1/reminder")).toHaveLength(2);
});
test("the reminder button is disabled without email and phone", async () => {
  mockData([{ ...protocol, status: "sent", eventId: event.id }], [event]);
  expect(await screen.findByRole("button", { name: /fără email \/ telefon/ })).toBeDisabled();
});
test("SMS button opens the pop-up with the PV link (?s=sms), sends it and confirms", async () => {
  const draft = { ...protocol, status: "draft", eventId: event.id, eventDate: "2026-08-23" };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => init?.method === "POST"
      ? { ok: true, to: "+40774612043", smsSentAt: new Date().toISOString(), smsSentCount: 1, status: "sent" }
      : url === "/api/handover" ? { items: [draft] } : { events: [{ ...event, client: { ...event.client, phone: "+40 774 612 043" } }] },
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><HandoverListPage /></MemoryRouter>);

  fireEvent.click(await screen.findByRole("button", { name: "💬 SMS" }));
  const textarea = screen.getByLabelText("Mesaj") as HTMLTextAreaElement;
  expect(textarea.value).toContain("evenimentul din data de 23 august 2026");
  expect(textarea.value).toMatch(/\/proces-verbal\/token\?s=sms$/);

  fireEvent.click(screen.getByRole("button", { name: "Trimite SMS" }));
  expect(await screen.findByText(/SMS trimis la \+40774612043 la ora/)).toBeInTheDocument();
  const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === "POST")!;
  expect(url).toBe("/api/handover/pv-1/sms");
  expect(JSON.parse(String(init!.body)).message).toBe(textarea.value.trim());
});

test("the SMS can't be sent once the PV link is deleted from the text", async () => {
  mockData([{ ...protocol, eventId: event.id }], [{ ...event, client: { ...event.client, phone: "0774612043" } }]);
  fireEvent.click(await screen.findByRole("button", { name: "💬 SMS" }));
  fireEvent.change(screen.getByLabelText("Mesaj"), { target: { value: "Bună ziua!" } });
  expect(screen.getByRole("button", { name: "Trimite SMS" })).toBeDisabled();
  expect(screen.getByText("Mesajul trebuie să conțină linkul spre procesul verbal.")).toBeInTheDocument();
});
