import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deadlineLabel, deliveryBoard } from "src/client/features/admin/components/previewDelivery";
import type { ClientEvent } from "src/client/features/admin/types";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

const today = new Date(2026, 9, 20, 15, 0);
const event = (id: string, eventDate: Date | null, delivery: ClientEvent["delivery"] = {}, status = "confirmat") =>
  ({ id, status, type: "Nuntă", eventDate, createdAt: new Date(), client: { fullName: `Client ${id}` }, delivery }) as unknown as ClientEvent;

describe("deliveryBoard", () => {
  test("groups by the next step, most urgent first", () => {
    const board = deliveryBoard([
      event("late", new Date(2026, 9, 14)),
      event("due-today", new Date(2026, 9, 17)),
      event("fresh", new Date(2026, 9, 19)),
      event("tag", new Date(2026, 9, 10), { previewSent: true, previewSentAt: new Date(2026, 9, 12).toISOString() }),
      event("done", new Date(2026, 9, 1), { previewSent: true, instagramTagged: true }),
      event("future", new Date(2026, 9, 25)),
      event("lead", new Date(2026, 9, 18), {}, "lead"),
      event("no-date", null),
    ], today);
    expect(board.late.map((r) => r.event.id)).toEqual(["late"]);
    expect(board.late[0].daysLeft).toBe(-3);
    expect(board.preview.map((r) => r.event.id)).toEqual(["due-today", "fresh"]);
    expect(board.preview[0].daysLeft).toBe(0);
    expect(board.tag[0].waitingTagDays).toBe(8);
    expect(board.done.map((r) => r.event.id)).toEqual(["done"]);
  });

  test("deadline wording", () => {
    expect(deadlineLabel(2)).toBe("mai ai 2 zile");
    expect(deadlineLabel(1)).toBe("mai ai o zi");
    expect(deadlineLabel(0)).toBe("termenul e azi");
    expect(deadlineLabel(-1)).toBe("întârziat o zi");
    expect(deadlineLabel(-4)).toBe("întârziat 4 zile");
  });
});

describe("PreviewDeliveryPage", () => {
  const sentAt = new Date(2026, 9, 12).toISOString();
  let patches: unknown[];

  beforeEach(() => {
    vi.useFakeTimers({ now: today, toFake: ["Date"] });
    patches = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") { patches.push(JSON.parse(String(init.body))); return new Response("{}", { status: 200 }); }
      return new Response(JSON.stringify({ events: [
        { ...event("a", null), eventDate: new Date(2026, 9, 14).toISOString(), createdAt: today.toISOString() },
        { ...event("b", null, { previewSent: true, previewSentAt: sentAt }), eventDate: new Date(2026, 9, 10).toISOString(), createdAt: today.toISOString() },
      ] }), { status: 200 });
    }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  test("„Rezolvă tot” ticks both steps, keeps the original preview date and moves the event to Predate", async () => {
    const { default: PreviewDeliveryPage } = await import("src/client/features/admin/components/PreviewDeliveryPage");
    render(<MemoryRouter><PreviewDeliveryPage /></MemoryRouter>);
    const card = (await screen.findByText("Client b")).closest("article")!;
    fireEvent.click(within(card).getByRole("button", { name: /Rezolvă tot/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ delivery: { previewSent: true, previewSentAt: sentAt, instagramTagged: true } });
    expect(screen.queryByText("Client b")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Predate · 1/ }));
    expect(screen.getByText("Client b")).toBeInTheDocument();
  });

  test("a late preview shows how late it is and can be marked sent", async () => {
    const { default: PreviewDeliveryPage } = await import("src/client/features/admin/components/PreviewDeliveryPage");
    render(<MemoryRouter><PreviewDeliveryPage /></MemoryRouter>);
    const card = (await screen.findByText("Client a")).closest("article")!;
    expect(within(card).getByText("întârziat 3 zile")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Am trimis preview-ul/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ delivery: { previewSent: true } });
    // Moved to "Așteaptă tag Instagram": the card now offers step ②.
    await waitFor(() => expect(within(screen.getByText("Client a").closest("article")!).getByRole("button", { name: /M-a etichetat/ })).toBeInTheDocument());
  });
});
