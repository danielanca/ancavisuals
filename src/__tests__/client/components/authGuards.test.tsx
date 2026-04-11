/*
 * Purpose: verifies the auth guard components that protect admin routes and redirect users
 * based on the current auth state exposed by the auth hook.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CheckAuth from "../../../client/features/admin/components/CheckAuth";
import RequireAuth from "../../../client/features/admin/components/RequireAuth";

const mockUseAuth = vi.fn();

vi.mock("../../../client/features/admin/auth/useAuth", () => ({
  default: () => mockUseAuth(),
}));

vi.mock("../../../client/components/UI/Loader", () => ({
  default: () => <div data-testid="auth-loader">Loading</div>,
}));

function renderRequireAuth(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<div>Admin dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCheckAuth(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<CheckAuth />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
        <Route path="/admin" element={<div>Admin dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("auth route guards", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  test("RequireAuth shows a loading spinner while auth state is pending", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: false, loading: true },
    });

    renderRequireAuth();

    expect(screen.getByTestId("auth-loader")).toBeInTheDocument();
  });

  test("RequireAuth redirects unauthorised users to login", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: false, loading: false },
    });

    renderRequireAuth();

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Admin dashboard")).not.toBeInTheDocument();
  });

  test("RequireAuth renders protected content for authorised users", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: true, loading: false },
    });

    renderRequireAuth();

    expect(screen.getByText("Admin dashboard")).toBeInTheDocument();
  });

  test("CheckAuth shows a loading spinner while auth state is pending", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: false, loading: true },
    });

    renderCheckAuth();

    expect(screen.getByTestId("auth-loader")).toBeInTheDocument();
  });

  test("CheckAuth keeps unauthenticated users on the login page", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: false, loading: false },
    });

    renderCheckAuth();

    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  test("CheckAuth redirects authenticated users away from the login page", () => {
    mockUseAuth.mockReturnValue({
      auth: { authorise: true, loading: false },
    });

    renderCheckAuth();

    expect(screen.getByText("Admin dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Login form")).not.toBeInTheDocument();
  });
});
