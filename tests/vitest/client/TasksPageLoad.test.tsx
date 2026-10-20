import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import TasksPage from "src/client/features/admin/components/Tasks/TasksPage";
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

const task = { id: "t1", title: "Trimite preview-ul", notes: "", clientName: "", eventId: null, status: "todo", priority: "normal", dueDate: null, plannedFor: null, durationMin: null, createdAt: null, updatedAt: null, completedAt: null };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
let tasksResponses: Array<() => Promise<Response>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/api/admin/events") return Promise.resolve(ok({ events: [] }));
    const next = tasksResponses.shift() ?? (() => Promise.reject(new TypeError("offline")));
    return next();
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// act() flushes React's queue only on exit, so step through time in small slices.
const advance = async (ms: number) => {
  for (let elapsed = 0; elapsed <= ms; elapsed += 250) await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(250, ms)); });
};

test("keeps loading and retries automatically until tasks arrive", async () => {
  tasksResponses = [
    ...Array.from({ length: 3 }, () => () => Promise.reject(new TypeError("Failed to fetch"))),
    () => Promise.resolve(ok({ tasks: [task] })),
  ];
  render(<TasksPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Se încarcă taskurile");
  await advance(3_500);
  expect(screen.queryByText(/Nu am putut încărca/)).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Se încarcă taskurile");
  await advance(4_000);
  expect(screen.getByRole("tab", { name: "De făcut (1)" })).toBeInTheDocument();
  expect(screen.queryByText(/Nu am putut încărca/)).not.toBeInTheDocument();
});

test("shows the error with a manual retry only after automatic rounds are exhausted", async () => {
  tasksResponses = [];
  render(<TasksPage />);
  await advance(30_000);
  expect(screen.getByRole("alert")).toHaveTextContent("Nu am putut încărca taskurile");
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  tasksResponses = [() => Promise.resolve(ok({ tasks: [task] }))];
  fireEvent.click(screen.getByRole("button", { name: "Reîncearcă" }));
  await advance(0);
  expect(screen.getByRole("tab", { name: "De făcut (1)" })).toBeInTheDocument();
});

test("does not retry on 401", async () => {
  tasksResponses = Array.from({ length: 4 }, () => () => Promise.resolve(new Response("{}", { status: 401 })));
  render(<TasksPage />);
  await advance(30_000);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("client options can be found by the written event date", async () => {
  const { eventDateSearchLabel } = await import("src/client/features/admin/components/Tasks/TasksPage");
  expect(eventDateSearchLabel("2026-08-08T00:00:00+03:00")).toBe("8 august 2026 · 08.08.2026");
  expect(eventDateSearchLabel("2026-08-07T21:30:00Z")).toBe("8 august 2026 · 08.08.2026");
  expect(eventDateSearchLabel(null)).toBe("fără dată");
  expect(eventDateSearchLabel("nu e dată")).toBe("fără dată");
});

test("„Încep” puts the task on the timeline at the current Bucharest time", async () => {
  vi.useRealTimers();
  vi.useFakeTimers({ now: new Date("2026-10-20T11:37:00Z"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] }); // 14:37 in Bucharest (EEST)
  tasksResponses = [
    () => Promise.resolve(ok({ tasks: [{ ...task, durationMin: 45 }] })),
    () => Promise.resolve(ok({ task: { ...task, durationMin: 45, status: "doing", plannedFor: "2026-10-20", scheduledStart: "14:37" } })),
  ];
  render(<TasksPage />);
  await advance(0);
  fireEvent.click(screen.getByRole("tab", { name: "De făcut (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Încep" }));
  await advance(0);
  const patch = vi.mocked(fetch).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
  expect(patch?.[0]).toBe("/api/admin/tasks/t1");
  expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
    status: "doing", plannedFor: "2026-10-20", scheduledStart: "14:37", durationMin: 45,
  });
});
