/*
 * Purpose: validates Firebase client bootstrap behavior, analytics initialization
 * and auth-state monitoring without talking to real Firebase services.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const loadFirebaseModule = async (options?: {
  analyticsSupported?: boolean;
  user?: { uid: string } | null;
  tokenResult?: { expirationTime: string };
  tokenError?: Error;
}) => {
  const appMock = { name: "mock-app" };
  const authMock = { name: "mock-auth" };
  const storageMock = { name: "mock-storage" };
  const dbMock = { name: "mock-db" };
  const analyticsMock = { name: "mock-analytics" };

  const initializeAppMock = vi.fn(() => appMock);
  const getAuthMock = vi.fn(() => authMock);
  const getStorageMock = vi.fn(() => storageMock);
  const getFirestoreMock = vi.fn(() => dbMock);
  const getAnalyticsMock = vi.fn(() => analyticsMock);
  const analyticsSupportedMock = vi.fn().mockResolvedValue(options?.analyticsSupported ?? false);
  const getIdTokenResultMock = options?.tokenError
    ? vi.fn().mockRejectedValue(options.tokenError)
    : vi.fn().mockResolvedValue(options?.tokenResult ?? { expirationTime: "2026-04-12T12:00:00Z" });
  const onAuthStateChangedMock = vi.fn((_auth, callback) => {
    void callback(options?.user ?? null);
    return vi.fn();
  });

  vi.doMock("firebase/app", () => ({
    initializeApp: initializeAppMock,
  }));

  vi.doMock("firebase/auth", () => ({
    getAuth: getAuthMock,
    onAuthStateChanged: onAuthStateChangedMock,
    getIdTokenResult: getIdTokenResultMock,
    signOut: vi.fn(),
  }));

  vi.doMock("firebase/analytics", () => ({
    getAnalytics: getAnalyticsMock,
    isSupported: analyticsSupportedMock,
  }));

  vi.doMock("firebase/storage", () => ({
    getStorage: getStorageMock,
  }));

  vi.doMock("firebase/firestore", () => ({
    getFirestore: getFirestoreMock,
  }));

  const module = await import("../../client/firebase");

  return {
    module,
    appMock,
    authMock,
    storageMock,
    dbMock,
    analyticsMock,
    initializeAppMock,
    getAuthMock,
    getStorageMock,
    getFirestoreMock,
    getAnalyticsMock,
    analyticsSupportedMock,
    getIdTokenResultMock,
    onAuthStateChangedMock,
  };
};

describe("client/firebase", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("initializes app, auth, storage and firestore on module load", async () => {
    const { module, appMock, authMock, storageMock, dbMock, initializeAppMock } = await loadFirebaseModule();

    expect(initializeAppMock).toHaveBeenCalledOnce();
    expect(module.default).toBe(appMock);
    expect(module.auth).toBe(authMock);
    expect(module.storage).toBe(storageMock);
    expect(module.db).toBe(dbMock);
  });

  test("initializes analytics when the browser runtime supports it", async () => {
    const { getAnalyticsMock, analyticsSupportedMock } = await loadFirebaseModule({
      analyticsSupported: true,
    });

    await Promise.resolve();

    expect(analyticsSupportedMock).toHaveBeenCalledOnce();
    expect(getAnalyticsMock).toHaveBeenCalledOnce();
  });

  test("skips analytics initialization when unsupported", async () => {
    const { getAnalyticsMock, analyticsSupportedMock } = await loadFirebaseModule({
      analyticsSupported: false,
    });

    await Promise.resolve();

    expect(analyticsSupportedMock).toHaveBeenCalledOnce();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });

  test("monitorAuthState logs token expiry for authenticated users", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { module, authMock, onAuthStateChangedMock, getIdTokenResultMock } = await loadFirebaseModule({
      user: { uid: "user-1" },
      tokenResult: { expirationTime: "2026-04-12T12:00:00Z" },
    });

    module.monitorAuthState(vi.fn());
    await vi.waitFor(() => {
      expect(consoleLog).toHaveBeenCalledWith("Token expiration time:", "2026-04-12T12:00:00Z");
    });

    expect(onAuthStateChangedMock).toHaveBeenCalledWith(authMock, expect.any(Function));
    expect(getIdTokenResultMock).toHaveBeenCalledWith({ uid: "user-1" });
    expect(consoleLog).toHaveBeenCalledWith("Token expiration time:", "2026-04-12T12:00:00Z");
  });

  test("monitorAuthState logs token lookup failures without logging the user out", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onLogout = vi.fn();
    const { module } = await loadFirebaseModule({
      user: { uid: "user-2" },
      tokenError: new Error("token failed"),
    });

    module.monitorAuthState(onLogout);
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    expect(consoleError).toHaveBeenCalledWith("Error fetching token result:", expect.any(Error));
    expect(onLogout).not.toHaveBeenCalled();
  });

  test("monitorAuthState invokes logout callback when there is no user", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const onLogout = vi.fn();
    const { module } = await loadFirebaseModule({
      user: null,
    });

    module.monitorAuthState(onLogout);
    await Promise.resolve();

    expect(onLogout).toHaveBeenCalledOnce();
    expect(consoleLog).toHaveBeenCalledWith("User is logged out");
  });
});
