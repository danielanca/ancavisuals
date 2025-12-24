// components/AdminArea/hooks/useAuth.ts
import { useContext } from "react";
import AuthContext from "../context/AuthProvider";

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // This is the error you saw — now it only happens if provider is missing
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
};

export default useAuth;
