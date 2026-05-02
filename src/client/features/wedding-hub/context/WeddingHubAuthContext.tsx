import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { weddingHubAuth } from "../firebaseWeddingHub";
import type { User } from "firebase/auth";
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { isBrowser } from "../../../utils/functions";

type WeddingHubAuthState = {
  coupleUser: User | null;
  coupleAccessToken: string;
  coupleAuthorised: boolean;
  coupleLoading: boolean;
};

type WeddingHubAuthContextType = {
  coupleAuth: WeddingHubAuthState;
  signInAsCouple: (email: string, password: string) => Promise<void>;
  signOutAsCouple: () => Promise<void>;
};

const WeddingHubAuthContext = createContext<WeddingHubAuthContextType | undefined>(undefined);

export const WeddingHubAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<WeddingHubAuthState>({
    coupleUser: null,
    coupleAccessToken: "",
    coupleAuthorised: false,
    coupleLoading: true,
  });

  useEffect(() => {
    if (!isBrowser()) {
      setState((previousState) => ({ ...previousState, coupleLoading: false }));
      return;
    }

    const unsubscribe = onIdTokenChanged(weddingHubAuth, async (user) => {
      if (!user) {
        setState({ coupleUser: null, coupleAccessToken: "", coupleAuthorised: false, coupleLoading: false });
        return;
      }
      const token = await user.getIdToken(false);
      setState({ coupleUser: user, coupleAccessToken: token, coupleAuthorised: true, coupleLoading: false });
    });

    return () => unsubscribe();
  }, []);

  const signInAsCouple = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(weddingHubAuth, email, password);
  }, []);

  const signOutAsCouple = useCallback(async () => {
    await signOut(weddingHubAuth);
    setState({ coupleUser: null, coupleAccessToken: "", coupleAuthorised: false, coupleLoading: false });
  }, []);

  const contextValue = useMemo<WeddingHubAuthContextType>(
    () => ({ coupleAuth: state, signInAsCouple, signOutAsCouple }),
    [state, signInAsCouple, signOutAsCouple],
  );

  return (
    <WeddingHubAuthContext.Provider value={contextValue}>
      {children}
    </WeddingHubAuthContext.Provider>
  );
};

export const useWeddingHubAuth = (): WeddingHubAuthContextType => {
  const context = useContext(WeddingHubAuthContext);
  if (!context) {
    throw new Error("useWeddingHubAuth must be used within <WeddingHubAuthProvider>");
  }
  return context;
};
