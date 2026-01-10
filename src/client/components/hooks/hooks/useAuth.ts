// hooks/useAuth.ts
import { useContext } from "react";
import AuthContext from "../../../components/context/AuthProvider";

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // This makes TS happy and saves you from silent runtime bugs
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx; // type is AuthContextValue, so `{ auth }` is valid
};

export default useAuth;
