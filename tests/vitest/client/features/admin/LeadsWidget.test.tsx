/*
 * Purpose: the dashboard leads widget lists saved leads and flags the ones whose
 * notification email never reached the inbox.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/context/PrivacyModeContext", () => ({ usePrivacyMode: () => ({ privacyMode: false }) }));

import LeadsWidget from "src/client/features/admin/components/LeadsWidget";

const now = new Date().toISOString();

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LeadsWidget", () => {
  test("excludes archived leads and removes an active lead only after a successful archive", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH"
      ? { ok: true, json: async () => ({ ok: true }) }
      : { ok: true, json: async () => ({ leads: [
        { id: "1", source: "configurator", name: "Activ", emailStatus: "sent", createdAt: now },
        { id: "2", source: "configurator", name: "Arhivat", archived: true, emailStatus: "failed", createdAt: now },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><LeadsWidget /></MemoryRouter>);
    expect(await screen.findByText("Activ")).toBeInTheDocument();
    expect(screen.queryByText("Arhivat")).not.toBeInTheDocument();
    expect(screen.getByText("1 în ultimele 7 zile")).toBeInTheDocument();
    expect(screen.queryByText("1 fără email")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));
    await waitFor(() => expect(screen.queryByText("Activ")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/1/archive", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ archived: true }) }));
  });

  test("keeps the lead visible when archiving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: init?.method !== "PATCH", json: async () => ({ leads: [
        { id: "1", source: "configurator", name: "Activ", emailStatus: "sent", createdAt: now },
      ] }),
    })));
    render(<MemoryRouter><LeadsWidget /></MemoryRouter>);
    await screen.findByText("Activ");
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nu s-a putut arhiva");
    expect(screen.getByText("Activ")).toBeInTheDocument();
  });
  test("shows leads with phone links and counts undelivered emails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ leads: [
        { id: "1", source: "configurator", name: "Ion Pop", phone: "0711111111", eventType: "Nuntă", eventDate: "12 iunie 2027", emailStatus: "skipped", emailReason: "filtru bot", createdAt: now },
        { id: "2", source: "campaign:olx", phone: "0722222222", emailStatus: "sent", createdAt: now },
      ] }),
    }));
    render(<MemoryRouter><LeadsWidget /></MemoryRouter>);

    expect(await screen.findByText("Ion Pop")).toBeInTheDocument();
    expect(screen.getByText("0711111111").closest("a")).toHaveAttribute("href", "tel:0711111111");
    expect(screen.getByText("1 fără email")).toBeInTheDocument();
    expect(screen.getByText("email netrimis")).toBeInTheDocument();
    expect(screen.getByText(/\/oferta\/olx/)).toBeInTheDocument();
    expect(screen.getByText("2 în ultimele 7 zile")).toBeInTheDocument();
  });

  test("shows an empty state when there are no leads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ leads: [] }) }));
    render(<MemoryRouter><LeadsWidget /></MemoryRouter>);
    expect(await screen.findByText(/Niciun lead încă/)).toBeInTheDocument();
  });
});
