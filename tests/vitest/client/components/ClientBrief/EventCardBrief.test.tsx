import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import EventCard from "src/client/features/admin/components/EventCard";
import type { ClientEvent } from "src/client/features/admin/types";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Redacted", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("src/client/features/admin/components/FileDropZone", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/MultiFileDropZone", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/PhotoboothUploader", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/AlbumPhotoUploader", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

test.each([
  ["more than three days ago", -4, undefined, false],
  ["exactly three days ago", -3, undefined, true],
  ["yesterday", -1, undefined, true],
  ["today", 0, undefined, true],
  ["future event", 5, undefined, true],
  ["multiple days ending three days ago", -7, -3, true],
  ["multiple days ending four days ago", -7, -4, false],
] as const)("brief visibility: %s", (_label, startOffset, endOffset, visible) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 7, 15));
  const event: ClientEvent = { id: "event-123", type: "Nuntă", status: "lead", fiscalized: false,
    createdAt: new Date(), eventDate: new Date(2026, 9, 7 + startOffset),
    eventEndDate: endOffset === undefined ? null : new Date(2026, 9, 7 + endOffset),
    services: [], client: { fullName: "Ana și Andrei", phone: "", email: "" },
    pricing: { total: 0, advanceAmount: 0, advancePaid: false, remainingAmount: 0 } };
  render(<MemoryRouter><EventCard event={event} /></MemoryRouter>);
  expect(Boolean(screen.queryByRole("button", { name: "Creează brief client" }))).toBe(visible);
});

test("brief creation appears only when the event is expanded", () => {
  const event: ClientEvent = { id: "event-123", type: "Nuntă", status: "lead", fiscalized: false,
    createdAt: new Date(), eventDate: null, services: [], client: { fullName: "Ana și Andrei", phone: "", email: "" },
    pricing: { total: 0, advanceAmount: 0, advancePaid: false, remainingAmount: 0 } };
  render(<MemoryRouter><EventCard event={event} initialCollapsed /></MemoryRouter>);
  expect(screen.queryByRole("button", { name: "Creează brief client" })).not.toBeInTheDocument();
  const header = screen.getAllByRole("button")[0];
  fireEvent.click(header);
  expect(screen.getByRole("button", { name: "Creează brief client" })).toBeInTheDocument();
  fireEvent.click(header);
  expect(screen.queryByRole("button", { name: "Creează brief client" })).not.toBeInTheDocument();
});
