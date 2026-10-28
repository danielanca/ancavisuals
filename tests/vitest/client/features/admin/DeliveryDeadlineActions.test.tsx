/*
 * Purpose: "Deadline livrare" actions — ☐ Livrat, and ⏰ Reminder (only when overdue) that asks
 * "peste câte zile" and creates an emailed memento for 10:00 Romania time that day.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import DeliveryDeadlineActions, { daysFromToday, romaniaTime } from "src/client/features/admin/components/DeliveryDeadlineActions";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T15:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("Romania time handles summer and winter time", () => {
  expect(romaniaTime("2026-10-30", 10)).toBe("2026-10-30T08:00:00.000Z");
  expect(romaniaTime("2026-07-01", 10)).toBe("2026-07-01T07:00:00.000Z");
  expect(daysFromToday(2)).toBe("2026-10-30");
});

test("reminder only when overdue; it creates a memento in 2 days and is saved on the event", async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: "m1" }) }));
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn();
  const toggle = vi.fn();
  const { rerender } = render(<DeliveryDeadlineActions kind="photo" done={false} overdue={false} eventName="Ana · Nuntă" eventDate="2026-09-05" onToggleDone={toggle} onReminderSaved={saved} />);
  expect(screen.queryByRole("button", { name: /Reminder/ })).toBeNull();

  rerender(<DeliveryDeadlineActions kind="photo" done={false} overdue eventName="Ana · Nuntă" eventDate="2026-09-05" onToggleDone={toggle} onReminderSaved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "⏰ Reminder" }));
  expect(screen.getByText("Peste câte zile îți trimit emailul?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2 zile" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith({ at: "2026-10-30T08:00:00.000Z", mementoId: "m1" }));
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/admin/mementos");
  expect(JSON.parse(String(init.body))).toMatchObject({ title: "Livrare foto: Ana · Nuntă", dueDate: "2026-10-30T08:00:00.000Z", category: "ancavisuals", reminderMinutesBefore: 240 });

  fireEvent.click(screen.getByLabelText("Livrat"));
  expect(toggle).toHaveBeenCalled();
});

test("delivering closes an active reminder", () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn();
  render(<DeliveryDeadlineActions kind="video" done={false} overdue eventName="Ana" eventDate="2026-09-05" reminder={{ at: "2026-10-30T08:00:00.000Z", mementoId: "m9" }} onToggleDone={vi.fn()} onReminderSaved={saved} />);
  expect(screen.getByRole("button", { name: /Reminder vineri, 30 octombrie/ })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Livrat"));
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/mementos/m9", expect.objectContaining({ method: "PATCH" }));
  expect(saved).toHaveBeenCalledWith(null);
});
