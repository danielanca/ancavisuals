/*
 * Purpose: sets up the shared test environment for DOM assertions and automatic
 * cleanup after each rendered test case.
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";

// Polyfill SlowBuffer for legacy CJS modules (e.g. buffer-equal-constant-time used by jwa/jsonwebtoken) in Node 22
try {
  const cjsRequire = createRequire(import.meta.url);
  const buf = cjsRequire("buffer");
  if (buf && !buf.SlowBuffer) {
    buf.SlowBuffer = buf.Buffer;
  }
} catch {}

globalThis.Buffer = Buffer;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Buffer = Buffer;
}

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = String(value); }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  }),
  key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
  get length() { return Object.keys(storage).length; },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

// Provide a minimal fetch stub so components that call fetch on mount
// (e.g. EUR rate requests) don't throw "fetch is not defined" in jsdom.
// Uses a plain function (not vi.fn) so vi.restoreAllMocks() in test files
// cannot clear the implementation.
// Individual tests override with vi.stubGlobal("fetch", ...) as needed.
const fallbackFetch = () => Promise.resolve({
  ok: false as const,
  status: 503,
  json: async () => ({}),
  text: async () => "",
});

beforeEach(() => {
  globalThis.Buffer = Buffer;
  localStorageMock.clear();
  globalThis.fetch = fallbackFetch as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
});
