import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { getCookie, isBrowser, setJWT } from "../../../utils/functions";
import { whenLandingSettled } from "../../../utils/whenLandingSettled";
import { loadFirebaseAuth } from "./loadFirebaseAuth";
import { markAuthFetchSignedOut, setAuthFetchUser } from "./authFetch";

const JWT_COOKIE = "jwt";
const JWT_TTL_HOURS = 24;
const ADMIN_COOKIE = "av_admin";
const ADMIN_COOKIE_DAYS = 365;

const CLIENT_PREVIEW_KEY = "av:client-preview";

const SUPREME_ADMIN_EMAIL = "ancadaniel1994@gmail.com";
const ESTERA_EMAIL = "estera.pop97@gmail.com";

export type UserRole = "admin" | "estera" | "moderator" | null;

type AuthState = {
  user: User | null;
  accessToken: string;
  /** Admin features visible. False in "Vezi ca client" mode outside /admin. */
  authorise: boolean;
  loading: boolean;
  role: UserRole;
};

type Ctx = {
  auth: AuthState;
  /** Really signed in as admin, even while previewing the site as a client. */
  signedInAsAdmin: boolean;
  clientPreview: boolean;
  setClientPreview: (on: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: "",
    authorise: false,
    loading: true,
    role: null,
  });
  const { pathname } = useLocation();
  const [clientPreview, setClientPreviewState] = useState(false);

  useEffect(() => {
    try { setClientPreviewState(localStorage.getItem(CLIENT_PREVIEW_KEY) === "1"); } catch { /* storage indisponibil */ }
  }, []);

  const setClientPreview = useCallback((on: boolean) => {
    setClientPreviewState(on);
    try {
      if (on) localStorage.setItem(CLIENT_PREVIEW_KEY, "1");
      else localStorage.removeItem(CLIENT_PREVIEW_KEY);
    } catch { /* storage indisponibil */ }
  }, []);

  // If no cookie exists on mount, we know for certain the user is logged out —
  // stop loading immediately instead of waiting for Firebase to confirm.
  useEffect(() => {
    if (!isBrowser()) return;
    if (!getCookie(JWT_COOKIE)) {
      markAuthFetchSignedOut();
      setState((s) => (s.user ? s : { ...s, loading: false }));
    }
  }, []);

  // Single listener: covers login, logout, and silent token refresh.
  // onIdTokenChanged is a superset of onAuthStateChanged.
  // On an ad landing it starts only once the page has loaded (the sign-in check is not
  // what the visitor came for); the admin cookie already tells the landing who is admin.
  useEffect(() => {
    const onUser = async (user: User | null) => {
      setAuthFetchUser(user);
      if (!user) {
        await setJWT(JWT_COOKIE, "", -1);
        await setJWT(ADMIN_COOKIE, "", -1);
        setState({ user: null, accessToken: "", authorise: false, loading: false, role: null });
        return;
      }
      const token = await user.getIdToken(false);
      await setJWT(JWT_COOKIE, token, JWT_TTL_HOURS);
      await setJWT(ADMIN_COOKIE, "1", ADMIN_COOKIE_DAYS * 24);
      try { localStorage.setItem("av_admin_device", "1"); } catch { /* storage indisponibil */ }
      const role: UserRole = user.email === SUPREME_ADMIN_EMAIL ? "admin" : user.email === ESTERA_EMAIL ? "estera" : "moderator";
      setState({ user, accessToken: token, authorise: true, loading: false, role });
    };
    let unsubscribe = () => {};
    let stopped = false;
    const cancel = whenLandingSettled(() => {
      loadFirebaseAuth()
        .then(({ auth, onIdTokenChanged }) => { if (!stopped) unsubscribe = onIdTokenChanged(auth, onUser); })
        .catch((error) => console.error("[auth] Firebase failed to load:", error));
    });
    return () => { stopped = true; cancel(); unsubscribe(); };
  }, []);

  // signIn delegates state update entirely to the listener above.
  const signIn = useCallback(async (email: string, password: string) => {
    const { auth, signInWithEmailAndPassword } = await loadFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logOut = useCallback(async () => {
    const { auth, signOut } = await loadFirebaseAuth();
    await signOut(auth);
    await setJWT(JWT_COOKIE, "", -1);
    await setJWT(ADMIN_COOKIE, "", -1);
    try { localStorage.removeItem("av_admin_device"); } catch { /* storage indisponibil */ }
    setClientPreview(false);
    setState({ user: null, accessToken: "", authorise: false, loading: false, role: null });
  }, [setClientPreview]);

  // The admin panel itself never switches to client view — only the public pages do.
  const hideAdminFeatures = clientPreview && !pathname.startsWith("/admin");

  const ctx = useMemo<Ctx>(
    () => ({
      auth: hideAdminFeatures ? { ...state, authorise: false } : state,
      signedInAsAdmin: state.authorise,
      clientPreview,
      setClientPreview,
      signIn,
      logOut,
    }),
    [state, hideAdminFeatures, clientPreview, setClientPreview, signIn, logOut],
  );

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export default AuthContext;
