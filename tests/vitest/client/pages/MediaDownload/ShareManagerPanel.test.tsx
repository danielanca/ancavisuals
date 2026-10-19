import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ShareManagerPanel, { formatAgo } from "src/client/pages/MediaDownload/ShareManagerPanel";

const link = (overrides = {}) => ({
  id: "s1",
  label: "Nașii",
  message: "",
  createdBy: "couple",
  count: 12,
  showAll: false,
  createdAt: Date.now(),
  lastViewedAt: null,
  views: 4,
  downloads: 1,
  forwards: 2,
  revoked: false,
  cover: null,
  ...overrides,
});

function mockFetch(links: unknown[]) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return { ok: true, json: async () => ({ ok: true }) };
    return { ok: true, json: async () => ({ links }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ShareManagerPanel", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  test("lists the couple's links with stats and totals, sending the couple key", async () => {
    const fetchMock = mockFetch([link(), link({ id: "g1", label: "", createdBy: "guest", views: 6, forwards: 0 })]);
    render(<ShareManagerPanel slug="ana-mihai" coupleKey="k1" refreshToken={0} />);

    expect(await screen.findByText(/Pentru Nașii/)).toBeTruthy();
    expect(screen.getByText(/2 linkuri · 10 deschideri · 2 trimiteri mai departe/)).toBeTruthy();
    expect(screen.getByText("De la invitați (1)")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/share/couple/ana-mihai/links", { headers: { "x-couple-key": "k1" } });
  });

  test("shows guest links on the guest tab", async () => {
    mockFetch([link(), link({ id: "g1", label: "", createdBy: "guest" })]);
    render(<ShareManagerPanel slug="ana-mihai" coupleKey="k1" refreshToken={0} />);

    fireEvent.click(await screen.findByText("De la invitați (1)"));
    expect(screen.getByText("Trimis de un invitat")).toBeTruthy();
  });

  test("revoking asks for confirmation, then patches the link", async () => {
    const fetchMock = mockFetch([link()]);
    render(<ShareManagerPanel slug="ana-mihai" coupleKey="k1" refreshToken={0} />);

    fireEvent.click(await screen.findByText("Dezactivează"));
    fireEvent.click(screen.getByText("Da, oprește linkul"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/share/couple/ana-mihai/links/s1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ revoked: true }) }),
    ));
    expect(screen.getByText("dezactivat")).toBeTruthy();
  });

  test("empty state explains how to send photos", async () => {
    mockFetch([]);
    render(<ShareManagerPanel slug="ana-mihai" coupleKey="k1" refreshToken={0} />);
    expect(await screen.findByText("Încă n-ați trimis nimănui poze.")).toBeTruthy();
  });

  test("formatAgo speaks Romanian", () => {
    const now = new Date("2026-10-19T15:00:00").getTime();
    expect(formatAgo(new Date("2026-10-19T09:00:00").getTime(), now)).toBe("azi");
    expect(formatAgo(new Date("2026-10-18T22:00:00").getTime(), now)).toBe("ieri");
    expect(formatAgo(new Date("2026-10-16T10:00:00").getTime(), now)).toBe("acum 3 zile");
    expect(formatAgo(null, now)).toBe("");
  });
});
