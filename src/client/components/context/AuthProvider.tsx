// components/AdminArea/context/AuthProvider.tsx
import React, { createContext, useEffect, useMemo, useState } from "react";
import { auth } from "../../firebase";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { getCookie, isBrowser } from "../../utils/functions"; // isBrowser from earlier snippet
import { setJWT } from "../../utils/functions";

type AuthState = {
  user: User | null;
  accessToken: string;   // Firebase ID token (JWT)
  authorise: boolean;    // your flag
  loading: boolean;
};

type Ctx = {
  auth: AuthState;
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Do NOT read cookies at init (may run on server).
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: "",
    authorise: false,
    loading: true,
  });

  // 1) Fast authorise hint from cookie (client only) to avoid initial flicker
  useEffect(() => {
    if (!isBrowser()) return;
    const hasJWT = Boolean(getCookie("jwt"));
    // only set authorise hint if we don't yet have a user
    setState((s) => (s.user ? s : { ...s, authorise: hasJWT }));
  }, []);

  // 2) Track auth user (login/logout)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // expire cookie: set past time (uses your helper)
        await setJWT("jwt", "", -1);
        setState({ user: null, accessToken: "", authorise: false, loading: false });
        return;
      }
      // get a fresh token on first detection of user
      const token = await user.getIdToken(/* forceRefresh */ true);
      await setJWT("jwt", token, 24); // keep 24h; adjust as you prefer
      setState({ user, accessToken: token, authorise: true, loading: false });
    });
    return () => unsubAuth();
  }, []);

  // 3) Keep token fresh (refresh/claims change)
  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      const token = await user.getIdToken(/* forceRefresh */ false);
      await setJWT("jwt", token, 24);
      setState((s) => ({ ...s, user, accessToken: token, authorise: true }));
    });
    return () => unsubToken();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const token = await user.getIdToken(true);
    await setJWT("jwt", token, 24);
    setState((s) => ({ ...s, user, accessToken: token, authorise: true, loading: false }));
  };

  const signUp = async (email: string, password: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    const token = await user.getIdToken(true);
    await setJWT("jwt", token, 24);
    setState((s) => ({ ...s, user, accessToken: token, authorise: true, loading: false }));
  };

  const logOut = async () => {
    await signOut(auth);
    await setJWT("jwt", "", -1); // expire immediately
    setState({ user: null, accessToken: "", authorise: false, loading: false });
  };

  const ctx = useMemo<Ctx>(
    () => ({ auth: state, setAuth: setState, signIn, signUp, logOut }),
    [state]
  );

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export default AuthContext;
