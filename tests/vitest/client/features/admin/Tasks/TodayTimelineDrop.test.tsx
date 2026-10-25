import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import TodayTimeline from "src/client/features/admin/components/Tasks/TodayTimeline";
afterEach(cleanup);

// A task dragged from the list isn't among the timeline's (scheduled) tasks: the drop must not
// send 60 minutes, or the page would overwrite the task's own estimate (ex. 3h → 1h).
test("dropping a task from the list leaves its duration to the page", () => {
  const onSchedule = vi.fn();
  const { container } = render(
    <TodayTimeline tasks={[]} today="2026-10-23" now={600} onSchedule={onSchedule}
      onUnschedule={vi.fn()} onComplete={vi.fn()} onExternalDragOver={vi.fn()} dragDurationMin={180} />,
  );
  const grid = container.querySelector("div.relative.mx-5")!;
  fireEvent.drop(grid, { clientX: 100, dataTransfer: { getData: () => "task-1" } });
  expect(onSchedule).toHaveBeenCalledTimes(1);
  expect(onSchedule.mock.calls[0][0]).toBe("task-1");
  expect(onSchedule.mock.calls[0][2]).toBeUndefined();
  expect(screen.queryByText(/Trage numărul/)).toBeInTheDocument();
});
