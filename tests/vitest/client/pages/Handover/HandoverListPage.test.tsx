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
  expect(screen.getByText("Proces verbal semnat pentru acest eveniment")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent('"scrollToEvent":"event-1"');
});
test("recognizes the reverse event association and keeps unsigned status clear", async () => {
  mockData([{ ...protocol, status: "sent" }], [{ ...event, handoverId: protocol.id }]);
  expect(await screen.findByRole("button", { name: /Eveniment: Ana și Ion/ })).toBeInTheDocument();
  expect(screen.getByText("Proces verbal încă nesemnat pentru acest eveniment")).toBeInTheDocument();
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
