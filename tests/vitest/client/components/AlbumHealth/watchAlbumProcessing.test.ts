import { ReadableStream } from "node:stream/web";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { watchAlbumProcessing } from "src/client/features/admin/components/watchAlbumProcessing";
const encoder = new TextEncoder();
function response(events: Record<string, unknown>[]) {
  return { ok: true, body: new ReadableStream({ start(controller) {
    for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    controller.close();
  } }) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
test("reconnects after EOF and recovers final completion without losing previous progress", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response([{ type: "progress", done: 500, total: 1000 }]))
    .mockResolvedValueOnce(response([{ type: "init", status: "done", progress: { done: 1000, total: 1000 } }]));
  vi.stubGlobal("fetch", fetchMock);
  const onEvent = vi.fn(); const connection = vi.fn();
  const stop = watchAlbumProcessing("test", "token", onEvent, connection);
  await vi.advanceTimersByTimeAsync(0);
  expect(onEvent).toHaveBeenCalledWith({ type: "progress", done: 500, total: 1000 });
  expect(connection).toHaveBeenLastCalledWith(true);
  await vi.advanceTimersByTimeAsync(3000);
  expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ status: "done" }));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  stop();
});
test("HTTP failures retry and cleanup cancels pending reconnections", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal("fetch", fetchMock);
  const onEvent = vi.fn(); const connection = vi.fn();
  const stop = watchAlbumProcessing("test", "token", onEvent, connection);
  await vi.advanceTimersByTimeAsync(3000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(onEvent).not.toHaveBeenCalled();
  expect(connection).toHaveBeenCalledWith(true);
  stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
test("a queued processing error is followed through automatic retry", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response([{ type: "error", error: "Retry scheduled" }]))
    .mockResolvedValueOnce(response([{ type: "init", status: "running" }, { type: "done" }]));
  vi.stubGlobal("fetch", fetchMock);
  const onEvent = vi.fn();
  const stop = watchAlbumProcessing("test", "token", onEvent, vi.fn());
  await vi.advanceTimersByTimeAsync(3000);
  expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual(["error", "init", "done"]);
  stop();
});
test("times out a stalled connection and reconnects", async () => {
  const fetchMock = vi.fn().mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  const connection = vi.fn();
  const stop = watchAlbumProcessing("test", "token", vi.fn(), connection);
  await vi.advanceTimersByTimeAsync(45_000);
  expect(connection).toHaveBeenLastCalledWith(true);
  await vi.advanceTimersByTimeAsync(3000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  stop();
  await vi.advanceTimersByTimeAsync(0);
});
