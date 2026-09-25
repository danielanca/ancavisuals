import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/media/album", href: "https://ancavisuals.ro/media/album", reload: vi.fn() },
  });
});

test("reloads after six distinct images, never repeatedly in the same page session", async () => {
  const { recordImageFailure } = await import("src/client/utils/imageFailureRecovery");
  for (let i = 0; i < 30; i++) recordImageFailure(`https://cdn.test/photo.webp?token=${i}`);
  expect(window.location.reload).not.toHaveBeenCalled();
  for (let i = 0; i < 4; i++) recordImageFailure(`https://cdn.test/${i}.webp`);
  expect(window.location.reload).not.toHaveBeenCalled();
  recordImageFailure("https://cdn.test/fifth.webp");
  expect(window.location.reload).toHaveBeenCalledTimes(1);
  vi.resetModules();
  const afterReload = await import("src/client/utils/imageFailureRecovery");
  for (let i = 0; i < 30; i++) afterReload.recordImageFailure(`https://cdn.test/${i}.webp`);
  expect(window.location.reload).toHaveBeenCalledTimes(1);
});

test("does not reload if the loop protection cannot be persisted", async () => {
  const { recordImageFailure } = await import("src/client/utils/imageFailureRecovery");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  for (let i = 0; i < 6; i++) recordImageFailure(`https://cdn.test/${i}.webp`);
  expect(window.location.reload).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("waits for ordinary image recovery and leaves managed retries to their component", async () => {
  vi.useFakeTimers();
  const { installImageFailureRecovery } = await import("src/client/utils/imageFailureRecovery");
  const stop = installImageFailureRecovery();
  try {
    for (let i = 0; i < 6; i++) {
      const img = document.createElement("img");
      img.src = `https://cdn.test/${i}.webp`;
      Object.defineProperty(img, "complete", { value: true });
      document.body.appendChild(img);
      img.dispatchEvent(new Event("error"));
    }
    expect(window.location.reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(7999);
    expect(window.location.reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  } finally {
    stop();
    document.body.replaceChildren();
    vi.useRealTimers();
  }
});
