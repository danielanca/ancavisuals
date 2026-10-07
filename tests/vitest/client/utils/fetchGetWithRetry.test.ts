import { afterEach, expect, test, vi } from "vitest";
import { fetchGetWithRetry } from "src/client/utils/fetchGetWithRetry";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("waits before retrying a failed GET and returns the recovered response", async () => {
  vi.useFakeTimers();
  const response = new Response("{}", { status: 200 });
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const request = fetchGetWithRetry("/api/admin/events");
  await vi.advanceTimersByTimeAsync(999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await request).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([401, 403, 404])("does not retry HTTP %s", async status => {
  const response = new Response(null, { status });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  expect(await fetchGetWithRetry("/api/admin/events")).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("returns a persistent server failure after three attempts", async () => {
  vi.useFakeTimers();
  const response = new Response(null, { status: 503 });
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const request = fetchGetWithRetry("/api/admin/settings");
  await vi.advanceTimersByTimeAsync(3000);
  expect(await request).toBe(response);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
