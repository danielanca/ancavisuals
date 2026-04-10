/*
 * Purpose: sets up the shared test environment for DOM assertions and automatic
 * cleanup after each rendered test case.
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
