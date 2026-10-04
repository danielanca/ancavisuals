import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), block: vi.fn(), get: vi.fn(), transaction: vi.fn() }));
vi.mock("src/server/notifications/emailFunnel", () => ({ sendViaFunnel: mocks.send, blockEmail: mocks.block }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "admin@example.test" } }));
vi.mock("src/server/firestore", () => ({ firestore: () => ({
  collection: () => ({ where: () => ({ get: mocks.get }) }), runTransaction: mocks.transaction,
}) }));
import { checkOverdueClientTasks, overdueSchedule } from "src/server/cron/clientTasks.cron";

const now = new Date("2026-10-04T11:00:00Z"); // 14:00 Bucharest, two hours after the task ends
const task = { status: "todo", title: "Preview <urgent>", clientName: "Ana & Ion", plannedFor: "2026-10-04", scheduledStart: "11:00", durationMin: 60 };

function documents(rows: Record<string, unknown>[]) {
  const docs = rows.map((data, index) => {
    const ref = { update: vi.fn(async (patch: object) => { Object.assign(data, patch); }) };
    return { id: String(index), ref, data: () => data };
  });
  mocks.get.mockResolvedValue({ docs });
  mocks.transaction.mockImplementation(async fn => fn({
    get: async (ref: unknown) => docs.find(d => d.ref === ref),
    update: (ref: typeof docs[number]["ref"], patch: object) => ref.update(patch),
  }));
  return docs;
}

describe("overdue timeline notifications", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue(undefined); });

  test("waits two hours after the end, ignores done/unscheduled/invalid tasks, defaults to one hour", () => {
    expect(overdueSchedule(task, new Date("2026-10-04T09:00:00Z"))).toBeNull();
    expect(overdueSchedule(task, new Date(now.getTime() - 60_000))).toBeNull();
    expect(overdueSchedule(task, now)?.end).toBe("2026-10-04 12:00");
    for (const patch of [{ status: "done" }, { plannedFor: null }, { scheduledStart: null }, { plannedFor: "2026-02-30" }, { durationMin: -1 }]) {
      expect(overdueSchedule({ ...task, ...patch }, now)).toBeNull();
    }
    expect(overdueSchedule({ ...task, durationMin: null }, now)).not.toBeNull();
  });

  test("handles midnight, multi-day blocks and winter/summer Bucharest clock", () => {
    const long = { ...task, plannedFor: "2026-10-02", scheduledStart: "23:00", durationMin: 2160 };
    expect(overdueSchedule(long, now)?.end).toBe("2026-10-04 11:00");
    expect(overdueSchedule({ ...task, plannedFor: "2026-01-04" }, new Date("2026-01-04T12:00:00Z"))).not.toBeNull();
    const dst = { ...task, plannedFor: "2026-10-24", scheduledStart: "23:00", durationMin: 360 };
    expect(overdueSchedule(dst, new Date("2026-10-25T04:59:00Z"))).toBeNull();
    expect(overdueSchedule(dst, new Date("2026-10-25T05:00:00Z"))?.end).toBe("2026-10-25 05:00");
  });

  test("sends escaped admin email once, persists deduplication and allows rescheduling", async () => {
    const data = { ...task };
    documents([data]);
    await checkOverdueClientTasks(now);
    await checkOverdueClientTasks(now);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@example.test", html: expect.stringContaining("Ana &amp; Ion"),
    }));
    expect(mocks.send.mock.calls[0][0].html).toContain("Preview &lt;urgent&gt;");
    for (const action of ["done", "tomorrow", "snooze"]) {
      expect(mocks.send.mock.calls[0][0].html).toMatch(new RegExp(`/api/task-email-actions/0/${action}\\?token=[a-f0-9]{64}`));
    }
    data.scheduledStart = "12:00";
    await checkOverdueClientTasks(new Date("2026-10-04T12:00:00Z"));
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  test("completion during the two-hour grace period prevents the email", async () => {
    const data = { ...task };
    documents([data]);
    await checkOverdueClientTasks(new Date("2026-10-04T10:59:00Z"));
    expect(mocks.send).not.toHaveBeenCalled();
    data.status = "done";
    await checkOverdueClientTasks(now);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("snoozed overdue task waits until the two-hour postponement expires", async () => {
    documents([{ ...task, timelineReminderSnoozedUntil: now.getTime() + 7_200_000 }]);
    await checkOverdueClientTasks(new Date(now.getTime() + 7_140_000));
    expect(mocks.send).not.toHaveBeenCalled();
    await checkOverdueClientTasks(new Date(now.getTime() + 7_200_000));
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  test("rechecks tasks completed since the query and respects active claims", async () => {
    documents([{ ...task, timelineReminderLeaseUntil: now.getTime() + 1000 }]);
    await checkOverdueClientTasks(now);
    expect(mocks.send).not.toHaveBeenCalled();
    documents([{ ...task }]);
    mocks.transaction.mockImplementationOnce(async fn => fn({ get: async () => ({ data: () => ({ ...task, status: "done" }) }) }));
    await checkOverdueClientTasks(now);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.block).toHaveBeenCalledTimes(2);
  });

  test("failed email retries after lease expiry and does not block other tasks", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const docs = documents([{ ...task }, { ...task, title: "Other" }]);
    mocks.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await checkOverdueClientTasks(now);
    expect(docs[0].data()).not.toHaveProperty("timelineReminderSentKey");
    expect(docs[1].data()).toHaveProperty("timelineReminderSentKey");
    await checkOverdueClientTasks(new Date(now.getTime() + 5 * 60_000));
    expect(docs[0].data()).toHaveProperty("timelineReminderSentKey");
    expect(mocks.send).toHaveBeenCalledTimes(3);
    error.mockRestore();
  });
});
