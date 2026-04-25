/*
 * Purpose: verifies that the EventCard edit form renders both date fields
 * correctly, that the end-date field enforces min=eventDate, and that
 * changes to the start date propagate to the end date's min constraint.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
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

function getDateInputs(container: HTMLElement): [HTMLInputElement, HTMLInputElement] {
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
  if (inputs.length < 2) throw new Error(`Expected 2 date inputs, found ${inputs.length}`);
  return [inputs[0], inputs[1]];
}

async function openEditModal(event: ClientEvent) {
  const { default: EventCard } = await import("src/client/features/admin/components/EventCard");

  const { container } = render(
    <EventCard
      event={event}
      initialCollapsed={false}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
    />,
  );

  const modifyButtons = screen.getAllByText("Modifică");
  fireEvent.click(modifyButtons[0]);

  return { container };
}

describe("EventCard — date fields in edit modal", () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  test("renders both date inputs when edit modal opens", async () => {
    const { container } = await openEditModal(makeEvent());

    const inputs = container.querySelectorAll('input[type="date"]');
    expect(inputs).toHaveLength(2);
  });

  test("start date input is pre-filled with the event date", async () => {
    const { container } = await openEditModal(makeEvent({ eventDate: new Date("2026-09-15") }));

    const [startInput] = getDateInputs(container);
    expect(startInput.value).toBe("2026-09-15");
  });

  test("end date input is empty when eventEndDate is null", async () => {
    const { container } = await openEditModal(makeEvent({ eventEndDate: null }));

    const [, endInput] = getDateInputs(container);
    expect(endInput.value).toBe("");
  });

  test("end date input is pre-filled when eventEndDate is set", async () => {
    const { container } = await openEditModal(makeEvent({
      eventDate: new Date("2026-09-15"),
      eventEndDate: new Date("2026-09-16"),
    }));

    const [, endInput] = getDateInputs(container);
    expect(endInput.value).toBe("2026-09-16");
  });

  test("end date input has min set to the current start date value", async () => {
    const { container } = await openEditModal(makeEvent({ eventDate: new Date("2026-09-15") }));

    const [, endInput] = getDateInputs(container);
    expect(endInput.min).toBe("2026-09-15");
  });

  test("changing start date updates the min constraint on end date", async () => {
    const { container } = await openEditModal(makeEvent({ eventDate: new Date("2026-09-15") }));

    const [startInput] = getDateInputs(container);
    fireEvent.change(startInput, { target: { value: "2026-10-20" } });

    const [, endInput] = getDateInputs(container);
    expect(endInput.min).toBe("2026-10-20");
  });

  test("both date inputs are of type date", async () => {
    const { container } = await openEditModal(makeEvent());

    const [startInput, endInput] = getDateInputs(container);
    expect(startInput.type).toBe("date");
    expect(endInput.type).toBe("date");
  });
});
