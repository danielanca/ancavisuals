/*
 * Purpose: verifies AdminBar renders nothing — the subscriber bell was moved to Navbar.
 */
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => mockUseAuth() }));
vi.mock("src/client/features/admin/providers/ErrorMonitorContext", () => ({ useErrorMonitor: vi.fn() }));

function authAdmin(accessToken = "tok-admin") {
  return { auth: { authorise: true, accessToken, loading: false }, logOut: vi.fn() };
}

let AdminBarLazy: React.ComponentType;

describe("AdminBar", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockUseAuth.mockReturnValue(authAdmin());
    vi.doMock("src/client/features/admin/auth/useAuth", () => ({ default: () => mockUseAuth() }));
    vi.doMock("src/client/features/admin/providers/ErrorMonitorContext", () => ({ useErrorMonitor: vi.fn() }));
    const mod = await import("src/client/components/UI/AdminBar");
    AdminBarLazy = mod.default;
  });

  test("renders nothing when not authorised", async () => {
    mockUseAuth.mockReturnValue({ auth: { authorise: false, accessToken: "", loading: false }, logOut: vi.fn() });
    const { container } = render(<MemoryRouter><AdminBarLazy /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when authorised (UI moved to Navbar)", async () => {
    const { container } = render(<MemoryRouter><AdminBarLazy /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });
});
