import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import EventCard from "src/client/features/admin/components/EventCard";
import type { ClientEvent } from "src/client/features/admin/types";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Redacted", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("src/client/features/admin/components/FileDropZone", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/MultiFileDropZone", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/PhotoboothUploader", () => ({ default: () => null }));
vi.mock("src/client/features/admin/components/AlbumPhotoUploader", () => ({ default: () => null }));

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
