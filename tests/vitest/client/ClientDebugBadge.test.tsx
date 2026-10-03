import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ClientDebugBadge from "src/client/features/admin/components/ClientDebugBadge";

const state = vi.hoisted(() => ({ auth: { loading: false, authorise: false } }));
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => state }));
vi.mock("src/client/features/admin/providers/ErrorMonitorContext", () => ({
  useErrorMonitor: () => ({
    errors: [{ id: "test", type: "client", message: "Test error", timestamp: new Date() }],
    clearErrors: vi.fn(),
  }),
}));

test("visitors and pending authentication never see the error badge", () => {
  state.auth = { loading: false, authorise: false };
  const { container, rerender } = render(<ClientDebugBadge />);
  expect(container).toBeEmptyDOMElement();
  state.auth = { loading: true, authorise: true };
  rerender(<ClientDebugBadge />);
  expect(container).toBeEmptyDOMElement();
});

test("an authenticated admin sees errors; logout hides even an open panel", () => {
  state.auth = { loading: false, authorise: true };
  const { container, rerender } = render(<ClientDebugBadge />);
  fireEvent.click(screen.getByTitle("Erori detectate"));
  expect(screen.getByText("Test error")).toBeInTheDocument();
  state.auth = { loading: false, authorise: false };
  rerender(<ClientDebugBadge />);
  expect(container).toBeEmptyDOMElement();
});
