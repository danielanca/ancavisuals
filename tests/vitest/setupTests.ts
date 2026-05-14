/*
 * Purpose: sets up the shared test environment for DOM assertions and automatic
 * cleanup after each rendered test case.
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

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
  vi.stubGlobal("fetch", fallbackFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
