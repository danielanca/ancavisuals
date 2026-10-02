/*
 * Purpose: verifies the "today" planning, suggestions and progress trend
 * calculations behind /admin/taskuri.
 */
import { describe, expect, test } from "vitest";
import {
  type ClientTask,
  addDays,
  bucharestDay,
  computeProgress,
  isEventWorkable,
  isForToday,
  moveItem,
  sortForToday,
  suggestForToday,
} from "src/client/features/admin/components/Tasks/taskStats";

const TODAY = "2026-10-02";

function task(overrides: Partial<ClientTask>): ClientTask {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Task",
    notes: "",
    clientName: "",
    eventId: null,
    status: "todo",
    priority: "normal",
    dueDate: null,
    plannedFor: null,
    createdAt: `${TODAY}T08:00:00.000Z`,
    updatedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("taskStats", () => {
  test("bucharestDay uses the Bucharest calendar day, not UTC", () => {
    expect(bucharestDay("2026-10-01T22:30:00.000Z")).toBe("2026-10-02");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  test("today includes planned, rolled-over and due tasks but not done ones", () => {
    expect(isForToday(task({ plannedFor: TODAY }), TODAY)).toBe(true);
    expect(isForToday(task({ plannedFor: "2026-09-30" }), TODAY)).toBe(true);
    expect(isForToday(task({ dueDate: "2026-09-29" }), TODAY)).toBe(true);
    expect(isForToday(task({ plannedFor: "2026-10-03" }), TODAY)).toBe(false);
    expect(isForToday(task({ plannedFor: TODAY, status: "done" }), TODAY)).toBe(false);
  });

  test("suggestions rank imminent deadlines first and skip tasks already on today", () => {
    const soon = task({ title: "termen mâine", dueDate: "2026-10-03" });
    const high = task({ title: "important", priority: "high" });
    const planned = task({ title: "deja azi", priority: "high", plannedFor: TODAY });
    const idle = task({ title: "nou", createdAt: `${TODAY}T07:00:00.000Z` });
    const result = suggestForToday([idle, high, planned, soon], TODAY);
    expect(result.map((s) => s.task.title)).toEqual(["termen mâine", "important"]);
    const urgent = task({ title: "urgent", priority: "urgent" });
    const medium = task({ title: "mediu", priority: "medium" });
    expect(suggestForToday([medium, high, urgent], TODAY).map((s) => s.task.title)).toEqual(["urgent", "important", "mediu"]);
    expect(result[0].reason).toContain("termen mâine");
  });

  test("progress reports a shrinking backlog as progress", () => {
    const tasks = [
      task({ createdAt: "2026-09-20T08:00:00.000Z", status: "done", completedAt: `${TODAY}T10:00:00.000Z` }),
      task({ createdAt: "2026-09-20T08:00:00.000Z", status: "done", completedAt: "2026-10-01T10:00:00.000Z" }),
      task({ createdAt: "2026-09-20T08:00:00.000Z" }),
      task({ createdAt: "2026-09-20T08:00:00.000Z", dueDate: "2026-09-30" }),
    ];
    const stats = computeProgress(tasks, TODAY);
    expect(stats.backlogWeekAgo).toBe(4);
    expect(stats.backlogNow).toBe(2);
    expect(stats.doneToday).toBe(1);
    expect(stats.doneThisWeek).toBe(2);
    expect(stats.streak).toBe(2);
    expect(stats.overdue).toBe(1);
    expect(stats.trend).toBe("progres");
    expect(stats.days).toHaveLength(14);
    expect(stats.days.at(-1)).toEqual({ day: TODAY, done: 1, created: 0 });
  });

  test("progress reports a growing backlog as falling behind", () => {
    const tasks = [task({}), task({}), task({ createdAt: "2026-09-20T08:00:00.000Z" })];
    expect(computeProgress(tasks, TODAY).trend).toBe("scadere");
  });

  test("client picker keeps past, undated and next-week events but hides far-future ones", () => {
    expect(isEventWorkable("2026-09-15T00:00:00.000Z", TODAY)).toBe(true);
    expect(isEventWorkable(null, TODAY)).toBe(true);
    expect(isEventWorkable("2026-10-09T00:00:00.000Z", TODAY)).toBe(true);
    expect(isEventWorkable("2026-10-10T00:00:00.000Z", TODAY)).toBe(false);
    expect(isEventWorkable("2027-06-12T00:00:00.000Z", TODAY)).toBe(false);
    expect(isEventWorkable("2028-08-20T00:00:00.000Z", TODAY)).toBe(false);
  });

  test("today keeps the manual order and shows not-yet-placed tasks on top", () => {
    const placedA = task({ title: "A", dayOrder: 1 });
    const placedB = task({ title: "B", dayOrder: 0 });
    const fresh = task({ title: "nou", priority: "urgent" });
    expect(sortForToday([placedA, fresh, placedB]).map((t) => t.title)).toEqual(["nou", "B", "A"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    const same = ["a"];
    expect(moveItem(same, 0, 1)).toBe(same);
  });
});
