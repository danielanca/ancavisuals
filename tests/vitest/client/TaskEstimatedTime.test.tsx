import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { QuickAdd, TaskEditor } from "src/client/features/admin/components/Tasks/TasksPage";
import type { ClientTask } from "src/client/features/admin/components/Tasks/taskStats";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
afterEach(cleanup);
const task: ClientTask = { id: "t1", title: "Editează filmul", notes: "", clientName: "", eventId: null, status: "todo", priority: "normal", dueDate: null, plannedFor: null, durationMin: 150, createdAt: null, updatedAt: null, completedAt: null };
const hours = () => screen.getByLabelText("Timp estimat (ore)");
const minutes = () => screen.getByLabelText("Timp estimat (minute)");

test("creates a task with hours + minutes, sent as total minutes, without scheduling an hour", async () => {
  const onCreate = vi.fn().mockResolvedValue(true);
  render(<QuickAdd events={[]} today="2026-10-09" onCreate={onCreate} />);
  fireEvent.change(screen.getByLabelText("Titlu task"), { target: { value: "Editează filmul" } });
  fireEvent.change(hours(), { target: { value: "2" } });
  fireEvent.change(minutes(), { target: { value: "30" } });
  expect(screen.getByText("= 2h 30m")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Adaugă task" }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ durationMin: 150 }));
  expect(onCreate.mock.calls[0][0]).not.toHaveProperty("scheduledStart");
  await waitFor(() => expect(hours()).toHaveValue(""));
  expect(minutes()).toHaveValue("");
});

test("plain text inputs (no spinner arrows) that keep only digits", () => {
  render(<QuickAdd events={[]} today="2026-10-09" onCreate={vi.fn()} />);
  expect(hours()).toHaveAttribute("type", "text");
  expect(minutes()).toHaveAttribute("inputmode", "numeric");
  fireEvent.change(hours(), { target: { value: "3h" } });
  expect(hours()).toHaveValue("3");
  expect(screen.getByText("= 3h")).toBeInTheDocument();
});

test("retains estimate after creation fails", async () => {
  render(<QuickAdd events={[]} today="2026-10-09" onCreate={vi.fn().mockResolvedValue(false)} />);
  fireEvent.change(screen.getByLabelText("Titlu task"), { target: { value: "Film" } });
  fireEvent.change(hours(), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Adaugă task" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Adaugă task" })).not.toBeDisabled());
  expect(hours()).toHaveValue("2");
});

test("loads an existing estimate as hours + minutes, changes and clears it", () => {
  const onSave = vi.fn();
  render(<TaskEditor task={task} events={[]} onSave={onSave} onDelete={vi.fn()} />);
  expect(hours()).toHaveValue("2");
  expect(minutes()).toHaveValue("30");
  fireEvent.change(hours(), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ durationMin: 90 }));
  fireEvent.change(hours(), { target: { value: "" } });
  fireEvent.change(minutes(), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează" }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ durationMin: null }));
});

test("leaves the estimate unset when creating without one", async () => {
  const onCreate = vi.fn().mockResolvedValue(true);
  render(<QuickAdd events={[]} today="2026-10-09" onCreate={onCreate} />);
  fireEvent.change(screen.getByLabelText("Titlu task"), { target: { value: "Sună clientul" } });
  fireEvent.click(screen.getByRole("button", { name: "Adaugă task" }));
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ durationMin: null }));
  await waitFor(() => expect(screen.getByLabelText("Titlu task")).toHaveValue(""));
});
