/*
 * Purpose: ensures the useAuth hook enforces provider usage and returns the current
 * auth context value when wrapped correctly.
 */
import React from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import useAuth from "src/client/features/admin/auth/useAuth";
import AuthContext from "src/client/features/admin/providers/AuthProvider";

describe("useAuth", () => {
  test("throws when used outside AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within <AuthProvider>");

    consoleError.mockRestore();
  });

  test("returns the active auth context when a provider is present", () => {
    const value = {
      auth: {
        user: null,
        accessToken: "token",
        authorise: true,
        loading: false,
      },
      signIn: async () => {},
      logOut: async () => {},
    };

    const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBe(value);
    expect(result.current.auth.authorise).toBe(true);
  });
});
