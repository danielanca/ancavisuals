import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { getCookie, isBrowser, setJWT } from "../../../utils/functions";
import { whenLandingSettled } from "../../../utils/whenLandingSettled";
import { loadFirebaseAuth } from "./loadFirebaseAuth";

const JWT_COOKIE = "jwt";
const JWT_TTL_HOURS = 24;
const ADMIN_COOKIE = "av_admin";
const ADMIN_COOKIE_DAYS = 365;

const SUPREME_ADMIN_EMAIL = "ancadaniel1994@gmail.com";
const ESTERA_EMAIL = "estera.pop97@gmail.com";

export type UserRole = "admin" | "estera" | "moderator" | null;

type AuthState = {
  user: User | null;
  accessToken: string;
  authorise: boolean;
  loading: boolean;
  role: UserRole;
};

type Ctx = {
  auth: AuthState;
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

  // If no cookie exists on mount, we know for certain the user is logged out —
  // stop loading immediately instead of waiting for Firebase to confirm.
  useEffect(() => {
    if (!isBrowser()) return;
    if (!getCookie(JWT_COOKIE)) {
      setState((s) => (s.user ? s : { ...s, loading: false }));
    }
  }, []);

  // Single listener: covers login, logout, and silent token refresh.
  // onIdTokenChanged is a superset of onAuthStateChanged.
  // On an ad landing it starts only once the page has loaded (the sign-in check is not
  // what the visitor came for); the admin cookie already tells the landing who is admin.
  useEffect(() => {
    const onUser = async (user: User | null) => {
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
    setState({ user: null, accessToken: "", authorise: false, loading: false, role: null });
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({ auth: state, signIn, logOut }),
    [state, signIn, logOut],
  );

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export default AuthContext;
