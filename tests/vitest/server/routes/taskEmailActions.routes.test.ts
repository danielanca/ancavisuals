import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ data: {} as Record<string, unknown>, exists: true, update: vi.fn(), transaction: vi.fn() }));
vi.mock("src/server/firestore", () => ({ firestore: () => ({
  collection: () => ({ doc: () => ({ get: async () => ({ data: () => mocks.exists ? mocks.data : undefined }) }) }),
  runTransaction: mocks.transaction,
}) }));
import router from "src/server/routes/taskEmailActions.routes";
import { applyTaskEmailAction, createTaskEmailActionToken, validTaskEmailAction } from "src/server/services/clientTaskEmailActions";

const now = new Date("2026-10-04T21:30:00Z"); // Oct 5 00:30 in Bucharest
let token: string;
function response() {
  const res = { set: vi.fn(), status: vi.fn(), type: vi.fn(), send: vi.fn() };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res;
}
function handler(method: string) {
  const layer = (router as any).stack.find((entry: any) => entry.route?.methods[method]);
  return layer.route.stack[0].handle;
}

describe("task actions from email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.exists = true;
    const generated = createTaskEmailActionToken("2026-10-04/11:00/60", now);
    token = generated.token;
    mocks.data = { title: "Preview <urgent>", status: "doing", plannedFor: "2026-10-04", scheduledStart: "11:00", durationMin: 60, ...generated.fields };
    mocks.update.mockImplementation((_ref, patch) => Object.assign(mocks.data, patch));
    mocks.transaction.mockImplementation(async fn => fn({
      get: async () => ({ data: () => mocks.exists ? mocks.data : undefined }), update: mocks.update,
    }));
  });

  test("done stamps completion and token cannot be replayed for another action", async () => {
    expect(await applyTaskEmailAction("t", token, "done", now)).toBe(true);
    expect(mocks.data.status).toBe("done");
    expect((mocks.data.completedAt as any).toDate()).toEqual(now);
    expect(await applyTaskEmailAction("t", token, "tomorrow", now, "15:30")).toBe(false);
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  test("tomorrow uses the chosen time and current Bucharest day, preserving duration", async () => {
    expect(await applyTaskEmailAction("t", token, "tomorrow", now, "15:30")).toBe(true);
    expect(mocks.data).toMatchObject({ plannedFor: "2026-10-06", scheduledStart: "15:30", durationMin: 60, status: "doing", timelineReminderSentKey: null });
  });

  test("tomorrow requires a valid time without consuming the token", async () => {
    for (const time of [undefined, "", "24:00", "9:30", "12:60"]) {
      expect(await applyTaskEmailAction("t", token, "tomorrow", now, time)).toBe(false);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(validTaskEmailAction(mocks.data, token, now)).toBe(true);
  });

  test("tomorrow link shows a required empty time field and saves only after selection", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const params = { id: "t", action: "tomorrow" };
    const getRes = response();
    await handler("get")({ params, query: { token } }, getRes);
    expect(getRes.send).toHaveBeenCalledWith(expect.stringContaining("Programează continuarea pe mâine"));
    expect(getRes.send).toHaveBeenCalledWith(expect.stringContaining('name="continuationTime" type="time" required'));
    expect(mocks.update).not.toHaveBeenCalled();
    const invalidRes = response();
    await handler("post")({ params, body: { token } }, invalidRes);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(mocks.update).not.toHaveBeenCalled();
    const savedRes = response();
    await handler("post")({ params, body: { token, continuationTime: "17:45" } }, savedRes);
    expect(savedRes.status).toHaveBeenCalledWith(200);
    expect(savedRes.send).toHaveBeenCalledWith(expect.stringContaining("mâine la 17:45"));
    expect(mocks.data).toMatchObject({ plannedFor: "2026-10-06", scheduledStart: "17:45" });
    vi.useRealTimers();
  });

  test("more time defers the next reminder exactly two hours", async () => {
    expect(await applyTaskEmailAction("t", token, "snooze", now)).toBe(true);
    expect(mocks.data).toMatchObject({ plannedFor: "2026-10-04", timelineReminderSnoozedUntil: now.getTime() + 7_200_000, timelineReminderSentKey: null });
  });

  test("rejects wrong, expired, deleted and stale-schedule tokens without writes", async () => {
    expect(await applyTaskEmailAction("t", "f".repeat(64), "done", now)).toBe(false);
    expect(await applyTaskEmailAction("t", token, "done", new Date(now.getTime() + 7 * 86400000))).toBe(false);
    mocks.data.scheduledStart = "12:00";
    expect(await applyTaskEmailAction("t", token, "done", now)).toBe(false);
    mocks.exists = false;
    expect(await applyTaskEmailAction("t", token, "done", now)).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("scanner GET only shows confirmation and escapes the task title", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const res = response();
    await handler("get")({ params: { id: "t", action: "done" }, query: { token } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Preview &lt;urgent&gt;"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('method="post"'));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("POST updates task and shows success, replay returns 410", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const req = { params: { id: "t", action: "done" }, body: { token } };
    const res = response();
    await handler("post")(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Taskul este marcat ca rezolvat."));
    const replay = response();
    await handler("post")(req, replay);
    expect(replay.status).toHaveBeenCalledWith(410);
    vi.useRealTimers();
  });

  test("malformed actions and tokens never update tasks", async () => {
    const res = response();
    await handler("post")({ params: { id: "t", action: "delete" }, body: { token } }, res);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(validTaskEmailAction(mocks.data, "", now)).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
