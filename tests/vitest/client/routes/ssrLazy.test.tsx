/*
 * Purpose: a lazy page whose code fails to download (flaky network, old file after a deploy)
 * reaches the chunk error boundary instead of spinning forever, and is fetched again next time.
 */
import React, { Component } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ssrLazy } from "src/client/routes/ssrLazy";

class Boundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <p>caught: {this.state.error.message}</p> : this.props.children; }
}

describe("ssrLazy", () => {
  test("a failed download reaches the error boundary, and the next mount fetches again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const load = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
      .mockResolvedValueOnce({ default: () => <p>city page</p> });
    const Page = ssrLazy("test-page", load);

    const first = render(<Boundary><Page /></Boundary>);
    await waitFor(() => expect(screen.getByText(/caught: Failed to fetch dynamically imported module/)).toBeTruthy());
    first.unmount();

    render(<Boundary><Page /></Boundary>);
    await waitFor(() => expect(screen.getByText("city page")).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(2);
  });
});
