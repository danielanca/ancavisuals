/*
 * Purpose: the event card's "Notifică" button reaches every album subscriber: email, SMS for
 * phone-only subscribers, and WhatsApp messages ready to send from the admin's own account.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EventCard from "src/client/features/admin/components/EventCard";
import type { ClientEvent } from "src/client/features/admin/types";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("src/client/features/admin/components/EventStatusBadge", () => ({
  default: () => <span>StatusBadge</span>,
}));

vi.mock("src/client/features/admin/components/FileDropZone", () => ({
  default: () => <div>FileDropZone</div>,
}));

vi.mock("src/client/features/admin/components/MultiFileDropZone", () => ({
  default: () => <div>MultiFileDropZone</div>,
}));

vi.mock("src/client/features/admin/components/ConfirmModal", () => ({
  default: () => <div>ConfirmModal</div>,
}));

vi.mock("src/client/utils/slugify", () => ({
  slugify: (s: string) => s,
}));

vi.mock("src/client/features/admin/auth/useAuth", () => ({
  default: () => ({ auth: { accessToken: "test-token" } }),
}));

function makeEvent(overrides: Partial<ClientEvent> = {}): ClientEvent {
  return {
    id: "ev-1",
    fiscalized: false,
    createdAt: new Date("2026-01-01"),
    eventDate: new Date("2026-09-15"),
    eventEndDate: null,
    status: "confirmat",
    type: "Nuntă",
    client: { fullName: "Ion Popescu", phone: "0712345678", email: "ion@test.ro" },
    services: [],
    pricing: { total: 1000, advanceAmount: 300, advancePaid: false, remainingAmount: 700 },
    ...overrides,
  };
}


// "Notifică": subscribers with only a phone get an SMS and a ready WhatsApp message (owner, 2026-10-28).
afterEach(() => vi.unstubAllGlobals());

test("Notifică shows the SMS result and one-tap WhatsApp links for phone-only subscribers", async () => {
  const link = "https://wa.me/40745123456?text=Buna";
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("/count/")
      ? { count: 2 }
      : { ok: true, sent: 1, sms: { sent: 1, failed: 0, skipped: false }, whatsapp: [{ name: "Ion", phone: "+40745123456", link }] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<EventCard event={makeEvent({ albumSlug: "nunta-ana" })} initialCollapsed={false} onUpdated={vi.fn()} onDeleted={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: /Notifică/ }));
  expect(await screen.findByRole("status")).toHaveTextContent("Email: 1 · SMS: 1");
  expect(screen.getByRole("link", { name: "WhatsApp → Ion" })).toHaveAttribute("href", link);
  expect(fetchMock).toHaveBeenCalledWith("/api/album-subscriptions/notify/nunta-ana", expect.objectContaining({ method: "POST" }));

  fireEvent.click(screen.getByRole("button", { name: "Ascunde linkurile WhatsApp" }));
  await waitFor(() => expect(screen.queryByRole("link", { name: "WhatsApp → Ion" })).not.toBeInTheDocument());
});
