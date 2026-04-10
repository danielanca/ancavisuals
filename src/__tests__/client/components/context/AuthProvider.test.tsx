import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthProvider } from "../../../../client/components/context/AuthProvider";
import useAuth from "../../../../client/hooks/useAuth";

const mockOnIdTokenChanged = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetCookie = vi.fn();
const mockIsBrowser = vi.fn();
const mockSetJWT = vi.fn();

vi.mock("../../../../client/firebase", () => ({
  auth: { app: "mock-auth" },
}));

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (...args: unknown[]) => mockOnIdTokenChanged(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock("../../../../client/utils/functions", () => ({
  getCookie: (...args: unknown[]) => mockGetCookie(...args),
  isBrowser: (...args: unknown[]) => mockIsBrowser(...args),
  setJWT: (...args: unknown[]) => mockSetJWT(...args),
}));

function AuthProbe() {
  const { auth, signIn, logOut } = useAuth();

  return (
    <div>
      <div data-testid="authorise">{String(auth.authorise)}</div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="token">{auth.accessToken}</div>
      <button onClick={() => signIn("admin@example.com", "secret")}>sign in</button>
      <button onClick={() => logOut()}>sign out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    mockOnIdTokenChanged.mockReset();
    mockSignInWithEmailAndPassword.mockReset();
    mockSignOut.mockReset();
    mockGetCookie.mockReset();
    mockIsBrowser.mockReset();
    mockSetJWT.mockReset();

    mockIsBrowser.mockReturnValue(true);
    mockGetCookie.mockReturnValue(null);
    mockSetJWT.mockResolvedValue(true);
    mockSignInWithEmailAndPassword.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockOnIdTokenChanged.mockReturnValue(() => {});
  });

  test("stops loading immediately when no auth cookie exists", async () => {
    mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
      void callback(null);
      return () => {};
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("authorise")).toHaveTextContent("false");
    });

    expect(mockGetCookie).toHaveBeenCalledWith("jwt");
    expect(mockSetJWT).toHaveBeenCalledWith("jwt", "", -1);
  });

  test("promotes an authenticated user when Firebase returns a token", async () => {
    const user = {
      getIdToken: vi.fn().mockResolvedValue("firebase-token"),
    };

    mockGetCookie.mockReturnValue("existing-cookie");
    mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
      void callback(user);
      return () => {};
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authorise")).toHaveTextContent("true");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("token")).toHaveTextContent("firebase-token");
    });

    expect(user.getIdToken).toHaveBeenCalledWith(false);
    expect(mockSetJWT).toHaveBeenCalledWith("jwt", "firebase-token", 24);
  });

  test("delegates signIn and logOut to Firebase auth helpers", async () => {
    mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
      void callback(null);
      return () => {};
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "sign in" }).click();
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      { app: "mock-auth" },
      "admin@example.com",
      "secret",
    );

    await act(async () => {
      screen.getByRole("button", { name: "sign out" }).click();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ app: "mock-auth" });
    expect(mockSetJWT).toHaveBeenCalledWith("jwt", "", -1);
  });
});
